import { describe, expect, it } from 'vitest';
import {
  computeSignature,
  signedHeaders,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  timingSafeEqual,
  verifySignature,
} from '../../convex/lib/signature';

const secret = 'test-secret';
const route = 'POST /api/automation/reminders';
const body = JSON.stringify({ loanId: 'abc', status: 'sent' });
const now = Date.UTC(2026, 10, 1, 12, 0, 0);

const signed = async (overrides: { at?: number; secret?: string } = {}) => {
  const headers = await signedHeaders(
    overrides.secret ?? secret,
    route,
    body,
    overrides.at ?? now,
  );
  return {
    signature: headers[SIGNATURE_HEADER],
    timestamp: headers[TIMESTAMP_HEADER],
  };
};

describe('webhook signatures', () => {
  it('matches a known HMAC-SHA256 vector', async () => {
    // printf '1700000000.POST /x.{}' | openssl dgst -sha256 -hmac test-secret
    const signature = await computeSignature(secret, {
      timestamp: 1700000000,
      route: 'POST /x',
      body: '{}',
    });
    expect(signature).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(signature).toBe(
      'v1=122c88e2b23342a028a9fcfb40e39dd7af96e8249294ef9d9d0a452a57ac289f',
    );
  });

  it('accepts a fresh, correctly signed request', async () => {
    const parts = await signed();
    await expect(
      verifySignature({ secret, route, body, now, ...parts }),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects a tampered body', async () => {
    const parts = await signed();
    const result = await verifySignature({
      secret,
      route,
      body: body.replace('sent', 'failed'),
      now,
      ...parts,
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects a signature made for another route', async () => {
    const parts = await signed();
    const result = await verifySignature({
      secret,
      route: 'GET /api/loans/overdue',
      body,
      now,
      ...parts,
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects the wrong secret', async () => {
    const parts = await signed({ secret: 'other' });
    const result = await verifySignature({
      secret,
      route,
      body,
      now,
      ...parts,
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects requests outside the 5 minute window (replay)', async () => {
    const old = await signed({ at: now - 6 * 60 * 1000 });
    const future = await signed({ at: now + 6 * 60 * 1000 });
    for (const parts of [old, future]) {
      const result = await verifySignature({
        secret,
        route,
        body,
        now,
        ...parts,
      });
      expect(result).toEqual({ ok: false, reason: 'TIMESTAMP_OUT_OF_RANGE' });
    }
  });

  it('rejects a modified timestamp even inside the window', async () => {
    const parts = await signed();
    const result = await verifySignature({
      secret,
      route,
      body,
      now,
      signature: parts.signature,
      timestamp: String(Number(parts.timestamp) - 10),
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects missing and malformed headers', async () => {
    const base = { secret, route, body, now };
    expect(
      await verifySignature({ ...base, signature: null, timestamp: '1' }),
    ).toEqual({ ok: false, reason: 'MISSING_SIGNATURE' });
    expect(
      await verifySignature({ ...base, signature: 'abc', timestamp: '1' }),
    ).toEqual({ ok: false, reason: 'MALFORMED_SIGNATURE' });
    expect(
      await verifySignature({ ...base, signature: 'v1=ab', timestamp: '1e9' }),
    ).toEqual({ ok: false, reason: 'INVALID_TIMESTAMP' });
  });

  it('timingSafeEqual compares exactly', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});
