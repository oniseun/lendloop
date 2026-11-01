import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { todayIso } from './lib/dates';
import { json } from './lib/http';
import { createLogger } from './lib/logger';
import { parseReminderClaim, parseReminderInput } from './lib/reminderInput';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from './lib/signature';

const logger = createLogger('http');
const http = httpRouter();

export const OVERDUE_ROUTE = 'GET /api/loans/overdue';
export const REMINDERS_ROUTE = 'POST /api/automation/reminders';
export const REMINDER_CLAIM_ROUTE = 'POST /api/automation/reminders/claim';
const MAX_BODY_BYTES = 4 * 1024;

const verifyInbound = async (request: Request, route: string, body: string) => {
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

http.route({
  path: '/api/loans/overdue',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const rejected = await verifyInbound(request, OVERDUE_ROUTE, '');
    if (rejected) return rejected;

    const today = todayIso();
    const loans = await ctx.runQuery(internal.automation.overdueLoans, {
      today,
    });
    logger.info('overdue loans served', { count: loans.length });
    return json(200, {
      success: true,
      message: 'OK',
      data: { date: today, loans },
    });
  }),
});

http.route({
  path: '/api/automation/reminders',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return json(413, { success: false, message: 'BODY_TOO_LARGE' });
    }
    const rejected = await verifyInbound(request, REMINDERS_ROUTE, body);
    if (rejected) return rejected;

    const parsed = parseReminderInput(body);
    if (!parsed.ok) {
      return json(400, { success: false, message: parsed.error });
    }

    const result = await ctx.runMutation(internal.automation.recordReminder, {
      ...parsed.value,
      signature: request.headers.get(SIGNATURE_HEADER)!,
    });
    if (result.outcome === 'loan_not_found') {
      return json(404, { success: false, message: 'LOAN_NOT_FOUND' });
    }
    // Replays and duplicates are 200 so n8n treats them as done and
    // stops retrying.
    return json(200, {
      success: true,
      message: result.outcome.toUpperCase(),
    });
  }),
});

http.route({
  path: '/api/automation/reminders/claim',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return json(413, { success: false, message: 'BODY_TOO_LARGE' });
    }
    const rejected = await verifyInbound(request, REMINDER_CLAIM_ROUTE, body);
    if (rejected) return rejected;

    const parsed = parseReminderClaim(body);
    if (!parsed.ok) {
      return json(400, { success: false, message: parsed.error });
    }

    const result = await ctx.runMutation(internal.automation.claimReminder, {
      ...parsed.value,
      signature: request.headers.get(SIGNATURE_HEADER)!,
    });
    if (result.outcome === 'loan_not_found') {
      return json(404, { success: false, message: 'LOAN_NOT_FOUND' });
    }
    // n8n sends the reminder only when claimed is true.
    return json(200, {
      success: true,
      message: result.outcome.toUpperCase(),
      data: { claimed: result.claimed },
    });
  }),
});

export default http;
