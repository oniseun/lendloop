import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import {
  signedHeaders,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from '../../convex/lib/signature';
import { listOverdueLoans } from '../../convex/model/automation';
import { createTest, signIn, type TestConvex } from './setup';

const INBOUND_SECRET = 'n8n-to-convex-test';
const OUTBOUND_SECRET = 'convex-to-n8n-test';
const NOW = new Date('2026-11-10T09:00:00Z');

const drill = {
  name: 'Cordless drill',
  category: 'power_tools' as const,
  condition: 'good' as const,
  description: 'Two batteries.',
};

const createLoan = async (t: TestConvex) => {
  const amara = await signIn(t, 'amara', 'Amara Okafor');
  const tom = await signIn(t, 'tom', 'Tom Hughes');
  const toolId = await amara.as.mutation(api.tools.create, drill);
  const loanId = await tom.as.mutation(api.loans.request, {
    toolId,
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    message: 'private note to the lender',
  });
  return { amara, tom, toolId, loanId };
};

// An approved loan that ended three days ago.
const createOverdueLoan = async (t: TestConvex) => {
  const { amara, tom, toolId } = await createLoan(t);
  const loanId = await t.run(async (ctx) => {
    const [pending] = await ctx.db.query('loans').collect();
    await ctx.db.patch(pending._id, { status: 'cancelled' });
    return ctx.db.insert('loans', {
      toolId,
      lenderId: amara.userId,
      borrowerId: tom.userId,
      startDate: '2026-11-01',
      endDate: '2026-11-07',
      status: 'approved',
    });
  });
  return { amara, tom, loanId };
};

const signedFetch = async (
  t: TestConvex,
  method: 'GET' | 'POST',
  path: string,
  body = '',
  secret = INBOUND_SECRET,
) => {
  const headers = await signedHeaders(secret, `${method} ${path}`, body);
  return t.fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? body : undefined,
  });
};

describe('Convex -> n8n request notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.N8N_REQUEST_WEBHOOK_URL = 'https://n8n.test/webhook/lendloop';
    process.env.CONVEX_TO_N8N_SECRET = OUTBOUND_SECRET;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends a signed, minimal payload to the lender on a new request', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const t = createTest();
    const { loanId } = await createLoan(t);

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe('https://n8n.test/webhook/lendloop');
    const body = init.body as string;
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({
      eventId: `${loanId}:loan.requested`,
      type: 'loan.requested',
      recipient: { firstName: 'Amara', email: 'amara@example.com' },
      tool: { name: 'Cordless drill' },
    });
    // Data minimisation: no borrower details, no free text.
    expect(body).not.toContain('tom@example.com');
    expect(body).not.toContain('private note');
    expect(body).not.toContain('Two batteries');

    const verified = await verifySignature({
      secret: OUTBOUND_SECRET,
      signature: init.headers[SIGNATURE_HEADER],
      timestamp: init.headers[TIMESTAMP_HEADER],
      route: 'POST /request-events',
      body,
    });
    expect(verified).toEqual({ ok: true });

    const [mine] = await (
      await signIn(t, 'tom', 'Tom Hughes')
    ).as.query(api.loans.mine, {});
    expect(mine.activity[0]).toMatchObject({
      kind: 'request_notification',
      status: 'sent',
    });
  });

  it('retries with backoff, then marks the delivery failed (never silent)', async () => {
    const fetchMock = vi.fn(async () => new Response('down', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const t = createTest();
    await createLoan(t);
    const admin = await signIn(t, 'ops', 'Ops Admin', 'admin');

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const failed = await admin.as.query(api.admin.failedDeliveries, {});
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ attempts: 3, lastError: 'HTTP_502' });

    // Admin can retry once n8n is back.
    fetchMock.mockImplementation(async () => new Response('ok'));
    await admin.as.mutation(api.admin.retryDelivery, {
      deliveryId: failed[0]._id,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await admin.as.query(api.admin.failedDeliveries, {})).toHaveLength(
      0,
    );
  });

  it('does not queue the same transition twice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok')),
    );
    const t = createTest();
    const { amara, loanId } = await createLoan(t);
    await amara.as.mutation(api.loans.approve, { loanId });
    await expect(
      amara.as.mutation(api.loans.approve, { loanId }),
    ).rejects.toThrow();
    const deliveries = await t.run((ctx) =>
      ctx.db.query('webhookDeliveries').collect(),
    );
    expect(deliveries.map((d) => d.eventType).sort()).toEqual([
      'loan.approved',
      'loan.requested',
    ]);
  });
});

describe('n8n -> Convex overdue endpoint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.N8N_TO_CONVEX_SECRET = INBOUND_SECRET;
    delete process.env.N8N_REQUEST_WEBHOOK_URL;
  });
  afterEach(() => vi.useRealTimers());

  it('rejects unsigned and wrongly signed requests', async () => {
    const t = createTest();
    const unsigned = await t.fetch('/api/loans/overdue', { method: 'GET' });
    expect(unsigned.status).toBe(401);
    const wrong = await signedFetch(t, 'GET', '/api/loans/overdue', '', 'nope');
    expect(wrong.status).toBe(401);
  });

  it('returns only overdue loans with the fields a reminder needs', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const response = await signedFetch(t, 'GET', '/api/loans/overdue');
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toEqual({
      date: '2026-11-10',
      loans: [
        {
          loanId,
          reminderDate: '2026-11-10',
          dueDate: '2026-11-07',
          daysOverdue: 3,
          borrower: { firstName: 'Tom', email: 'tom@example.com' },
          tool: { name: 'Cordless drill' },
        },
      ],
    });
  });

  it('records reminders idempotently and hides reminded loans for the day', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const body = JSON.stringify({
      loanId,
      reminderDate: '2026-11-10',
      status: 'sent',
      channel: 'email',
    });

    const first = await signedFetch(
      t,
      'POST',
      '/api/automation/reminders',
      body,
    );
    expect(await first.json()).toMatchObject({ message: 'RECORDED' });

    // A retry from n8n (fresh signature, same reminder) changes nothing.
    vi.advanceTimersByTime(1000);
    const retry = await signedFetch(
      t,
      'POST',
      '/api/automation/reminders',
      body,
    );
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ message: 'UNCHANGED' });

    const events = await t.run((ctx) =>
      ctx.db.query('automationEvents').collect(),
    );
    expect(events.filter((e) => e.kind === 'overdue_reminder')).toHaveLength(1);

    const overdue = await signedFetch(t, 'GET', '/api/loans/overdue');
    expect((await overdue.json()).data.loans).toHaveLength(0);
  });

  it('a failed reminder can be retried, a sent one is never downgraded', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const send = async (status: 'sent' | 'failed') => {
      vi.advanceTimersByTime(1000);
      const body = JSON.stringify({
        loanId,
        reminderDate: '2026-11-10',
        status,
      });
      return (
        await signedFetch(t, 'POST', '/api/automation/reminders', body)
      ).json();
    };
    expect(await send('failed')).toMatchObject({ message: 'RECORDED' });
    expect(await send('sent')).toMatchObject({ message: 'UPDATED' });
    expect(await send('failed')).toMatchObject({ message: 'UNCHANGED' });
  });

  it('lets only one run claim a reminder, and hides claimed loans', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const body = JSON.stringify({ loanId, reminderDate: '2026-11-10' });
    const claim = async () => {
      vi.advanceTimersByTime(1000);
      const res = await signedFetch(
        t,
        'POST',
        '/api/automation/reminders/claim',
        body,
      );
      return (await res.json()).data.claimed;
    };
    expect(await claim()).toBe(true);
    expect(await claim()).toBe(false);

    const overdue = await signedFetch(t, 'GET', '/api/loans/overdue');
    expect((await overdue.json()).data.loans).toHaveLength(0);

    // A failed send frees the claim for a retry.
    const failed = JSON.stringify({
      loanId,
      reminderDate: '2026-11-10',
      status: 'failed',
    });
    vi.advanceTimersByTime(1000);
    await signedFetch(t, 'POST', '/api/automation/reminders', failed);
    expect(await claim()).toBe(true);
  });

  it('skips handled loans before applying the page limit', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const second = await t.run(async (ctx) => {
      const loan = (await ctx.db.get(loanId))!;
      const { _id: _ignored, _creationTime: _ignoredTime, ...rest } = loan;
      return ctx.db.insert('loans', { ...rest, endDate: '2026-11-08' });
    });
    const body = JSON.stringify({ loanId, reminderDate: '2026-11-10' });
    await signedFetch(t, 'POST', '/api/automation/reminders/claim', body);

    const page = await t.run((ctx) => listOverdueLoans(ctx, '2026-11-10', 1));
    expect(page.map((loan) => loan.loanId)).toEqual([second]);
  });

  it('answers a retried claim the same way instead of stranding it', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const body = JSON.stringify({ loanId, reminderDate: '2026-11-10' });
    const route = 'POST /api/automation/reminders/claim';
    const headers = {
      'content-type': 'application/json',
      ...(await signedHeaders(INBOUND_SECRET, route, body)),
    };
    const init = { method: 'POST', headers, body };
    const first = await (
      await t.fetch('/api/automation/reminders/claim', init)
    ).json();
    const retry = await (
      await t.fetch('/api/automation/reminders/claim', init)
    ).json();
    expect(first).toMatchObject({
      message: 'CLAIMED',
      data: { claimed: true },
    });
    expect(retry).toMatchObject({
      message: 'REPLAYED',
      data: { claimed: true },
    });
  });

  it('ignores an exact replay of an accepted request', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const body = JSON.stringify({
      loanId,
      reminderDate: '2026-11-10',
      status: 'failed',
    });
    const headers = {
      'content-type': 'application/json',
      ...(await signedHeaders(
        INBOUND_SECRET,
        'POST /api/automation/reminders',
        body,
      )),
    };
    const init = { method: 'POST', headers, body };
    expect(
      await (await t.fetch('/api/automation/reminders', init)).json(),
    ).toMatchObject({ message: 'RECORDED' });
    expect(
      await (await t.fetch('/api/automation/reminders', init)).json(),
    ).toMatchObject({ message: 'REPLAYED' });
  });

  it('rejects stale signatures and bad bodies', async () => {
    const t = createTest();
    const { loanId } = await createOverdueLoan(t);
    const body = JSON.stringify({
      loanId,
      reminderDate: '2026-11-10',
      status: 'sent',
    });
    const headers = await signedHeaders(
      INBOUND_SECRET,
      'POST /api/automation/reminders',
      body,
    );
    vi.advanceTimersByTime(6 * 60 * 1000);
    const stale = await t.fetch('/api/automation/reminders', {
      method: 'POST',
      headers,
      body,
    });
    expect(stale.status).toBe(401);

    const bad = await signedFetch(
      t,
      'POST',
      '/api/automation/reminders',
      JSON.stringify({ loanId, reminderDate: 'yesterday', status: 'sent' }),
    );
    expect(bad.status).toBe(400);

    const missing = await signedFetch(
      t,
      'POST',
      '/api/automation/reminders',
      JSON.stringify({
        loanId: 'nope',
        reminderDate: '2026-11-10',
        status: 'sent',
      }),
    );
    expect(missing.status).toBe(404);
  });
});
