// @vitest-environment node
import * as nodeCrypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUEST_EVENTS_ROUTE } from '../../convex/automation';
import { signedHeaders, verifySignature } from '../../convex/lib/signature';

// The n8n side of the signing scheme lives in Code nodes inside the
// exported workflows. These tests run that exact code against the
// Convex implementation so the two can't drift apart.

interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  retryOnFail?: boolean;
}
interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  settings: Record<string, unknown>;
}

const dir = join(__dirname, '../../n8n/workflows');
const files = readdirSync(dir).filter((file) => file.endsWith('.json'));
const workflows = Object.fromEntries(
  files.map((file) => [
    file,
    JSON.parse(readFileSync(join(dir, file), 'utf8')) as Workflow,
  ]),
);

const codeOf = (file: string, nodeName: string) => {
  const node = workflows[file].nodes.find((item) => item.name === nodeName);
  if (!node) throw new Error(`${nodeName} not found in ${file}`);
  return node.parameters.jsCode as string;
};

type Sandbox = {
  $env: Record<string, string>;
  $json: unknown;
  $input?: unknown;
  staticData?: Record<string, unknown>;
};

const runCode = (code: string, sandbox: Sandbox) => {
  const fn = new Function(
    'require',
    '$env',
    '$json',
    '$input',
    '$getWorkflowStaticData',
    code,
  );
  return fn(
    (name: string) => {
      if (name !== 'crypto') throw new Error(`blocked require: ${name}`);
      return nodeCrypto;
    },
    sandbox.$env,
    sandbox.$json,
    sandbox.$input ?? { item: {}, first: () => ({ json: sandbox.$json }) },
    () => sandbox.staticData ?? {},
  );
};

describe('exported n8n workflows', () => {
  it('contain no secrets or credential data', () => {
    for (const [file, workflow] of Object.entries(workflows)) {
      const raw = JSON.stringify(workflow);
      expect(raw, file).not.toMatch(/"data"\s*:\s*\{[^}]*password/i);
      expect(raw, file).not.toMatch(/sk_(test|live)_|whsec_|-----BEGIN/);
      // Secrets are only ever read from the environment.
      for (const node of workflow.nodes) {
        const code = String(node.parameters.jsCode ?? '');
        for (const match of code.matchAll(/SECRET\s*=\s*([^;\n]+)/g)) {
          expect(match[1].trim(), `${file} / ${node.name}`).toMatch(/^\$env\./);
        }
      }
      for (const node of workflow.nodes) {
        for (const credential of Object.values(node.credentials ?? {})) {
          expect(Object.keys(credential).sort()).toEqual(['id', 'name']);
        }
      }
    }
  });

  it('route failures to the error workflow and retry HTTP calls', () => {
    const errorWorkflow = workflows['error-handler.json'];
    for (const file of [
      'request-notification.json',
      'overdue-reminders.json',
    ]) {
      expect(workflows[file].settings.errorWorkflow).toBe(errorWorkflow.id);
    }
    const httpNodes = workflows['overdue-reminders.json'].nodes.filter(
      (node) => node.type === 'n8n-nodes-base.httpRequest',
    );
    expect(httpNodes).toHaveLength(2);
    for (const node of httpNodes) expect(node.retryOnFail).toBe(true);
  });
});

describe('n8n -> Convex signing (Code nodes)', () => {
  const secret = 'shared-inbound-secret';
  const $env = { LENDLOOP_N8N_TO_CONVEX_SECRET: secret };

  it('overdue GET signature is accepted by Convex', async () => {
    const out = runCode(
      codeOf('overdue-reminders.json', 'Sign overdue request'),
      {
        $env,
        $json: {},
      },
    );
    const result = await verifySignature({
      secret,
      signature: out.json.signature,
      timestamp: out.json.timestamp,
      route: 'GET /api/loans/overdue',
      body: '',
    });
    expect(result).toEqual({ ok: true });
  });

  it('reminder write-back signature is accepted by Convex', async () => {
    const out = runCode(codeOf('overdue-reminders.json', 'Sign write-back'), {
      $env,
      $json: {
        loanId: 'loan1',
        reminderDate: '2026-11-01',
        status: 'sent',
        channel: 'email',
      },
    });
    expect(JSON.parse(out.json.body)).toEqual({
      loanId: 'loan1',
      reminderDate: '2026-11-01',
      status: 'sent',
      channel: 'email',
    });
    const result = await verifySignature({
      secret,
      signature: out.json.signature,
      timestamp: out.json.timestamp,
      route: 'POST /api/automation/reminders',
      body: out.json.body,
    });
    expect(result).toEqual({ ok: true });
  });
});

describe('Convex -> n8n verification (Code node)', () => {
  const secret = 'shared-outbound-secret';
  const $env = { LENDLOOP_CONVEX_TO_N8N_SECRET: secret };
  const verifyCode = codeOf('request-notification.json', 'Verify signature');
  const event = {
    eventId: 'loan1:loan.requested',
    type: 'loan.requested',
    recipient: { firstName: 'Amara', email: 'amara@example.com' },
  };
  const body = JSON.stringify(event);

  const webhookItem = async (
    payload: string,
    headers?: Record<string, string>,
  ) => ({
    headers:
      headers ?? (await signedHeaders(secret, REQUEST_EVENTS_ROUTE, payload)),
    body: JSON.parse(payload),
  });

  it('accepts an event signed by Convex', async () => {
    const out = runCode(verifyCode, { $env, $json: await webhookItem(body) });
    expect(out.json).toEqual({ status: 'ok', event });
  });

  it('rejects a tampered body', async () => {
    const headers = await signedHeaders(secret, REQUEST_EVENTS_ROUTE, body);
    const tampered = body.replace('Amara', 'Mallory');
    const out = runCode(verifyCode, {
      $env,
      $json: await webhookItem(tampered, headers),
    });
    expect(out.json).toEqual({
      status: 'invalid',
      reason: 'INVALID_SIGNATURE',
    });
  });

  it('rejects an old timestamp', async () => {
    const at = Date.now() - 10 * 60 * 1000;
    const headers = await signedHeaders(secret, REQUEST_EVENTS_ROUTE, body, at);
    const out = runCode(verifyCode, {
      $env,
      $json: await webhookItem(body, headers),
    });
    expect(out.json.reason).toBe('TIMESTAMP_OUT_OF_RANGE');
  });

  it('flags an event that was already processed', async () => {
    const out = runCode(verifyCode, {
      $env,
      $json: await webhookItem(body),
      staticData: { processedEvents: { [event.eventId]: Date.now() } },
    });
    expect(out.json).toEqual({ status: 'duplicate', eventId: event.eventId });
  });
});
