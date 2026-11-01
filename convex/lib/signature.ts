import { SIGNATURE_TOLERANCE_MS } from './constants';

// HMAC-SHA256 request signing, used in both directions:
//   Convex -> n8n   (request notifications)
//   n8n -> Convex   (overdue list + reminder write-back)
//
// Signed string: `${timestamp}.${route}.${body}`
//   timestamp  unix seconds, also sent as a header
//   route      logical endpoint, e.g. "POST /api/automation/reminders",
//              so a signature for one endpoint can't be replayed on another
//   body       raw request body ('' for GET)
//
// Header: x-lendloop-signature: v1=<hex>
// The n8n Code nodes in n8n/workflows implement the same scheme.

export const SIGNATURE_HEADER = 'x-lendloop-signature';
export const TIMESTAMP_HEADER = 'x-lendloop-timestamp';
const VERSION = 'v1';

export interface SignedParts {
  timestamp: number;
  route: string;
  body: string;
}

export type VerifyFailure =
  | 'MISSING_SIGNATURE'
  | 'MALFORMED_SIGNATURE'
  | 'INVALID_TIMESTAMP'
  | 'TIMESTAMP_OUT_OF_RANGE'
  | 'INVALID_SIGNATURE';

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const signingString = ({ timestamp, route, body }: SignedParts) =>
  `${timestamp}.${route}.${body}`;

export const computeSignature = async (secret: string, parts: SignedParts) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingString(parts)),
  );
  return `${VERSION}=${toHex(mac)}`;
};

// Constant time for equal-length inputs. Length is not secret (fixed hex).
export const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

export interface VerifyInput {
  secret: string;
  signature: string | null;
  timestamp: string | null;
  route: string;
  body: string;
  now?: number;
  toleranceMs?: number;
}

export const verifySignature = async ({
  secret,
  signature,
  timestamp,
  route,
  body,
  now = Date.now(),
  toleranceMs = SIGNATURE_TOLERANCE_MS,
}: VerifyInput): Promise<VerifyResult> => {
  if (!signature || !timestamp)
    return { ok: false, reason: 'MISSING_SIGNATURE' };
  if (!signature.startsWith(`${VERSION}=`)) {
    return { ok: false, reason: 'MALFORMED_SIGNATURE' };
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    return { ok: false, reason: 'INVALID_TIMESTAMP' };
  }
  const ts = Number(timestamp);
  if (Math.abs(now - ts * 1000) > toleranceMs) {
    return { ok: false, reason: 'TIMESTAMP_OUT_OF_RANGE' };
  }
  const expected = await computeSignature(secret, {
    timestamp: ts,
    route,
    body,
  });
  if (!timingSafeEqual(expected, signature)) {
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }
  return { ok: true };
};

export const signedHeaders = async (
  secret: string,
  route: string,
  body: string,
  now: number = Date.now(),
) => {
  const timestamp = Math.floor(now / 1000);
  return {
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: await computeSignature(secret, {
      timestamp,
      route,
      body,
    }),
  };
};
