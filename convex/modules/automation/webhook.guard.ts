import { json } from '../../lib/http';
import { createLogger } from '../../lib/logger';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from '../../lib/signature';

const logger = createLogger('http');

// Guard for every inbound n8n route: verifies the HMAC signature and
// timestamp. Returns a response to send back when the request is
// rejected, or null when it may proceed.
export const verifyInbound = async (
  request: Request,
  route: string,
  body: string,
): Promise<Response | null> => {
  const secret = process.env.N8N_TO_CONVEX_SECRET;
  if (!secret) {
    logger.error('N8N_TO_CONVEX_SECRET not set', { route });
    return json(503, { success: false, message: 'NOT_CONFIGURED' });
  }
  const result = await verifySignature({
    secret,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    route,
    body,
  });
  if (!result.ok) {
    logger.warn('signature rejected', { route, reason: result.reason });
    // Same response for every failure: don't tell a caller which part
    // of the signature was wrong.
    return json(401, { success: false, message: 'INVALID_SIGNATURE' });
  }
  return null;
};
