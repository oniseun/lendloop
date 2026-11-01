import type { Doc } from '../../_generated/dataModel';
import { signedHeaders } from '../../lib/signature';

// Outbound HTTP to n8n. The only place that knows the webhook URL and
// how requests are signed. Returns an error code, or undefined on 2xx.

export const REQUEST_EVENTS_ROUTE = 'POST /request-events';
const DELIVERY_TIMEOUT_MS = 10_000;

export const sendRequestEvent = async (
  delivery: Pick<Doc<'webhookDeliveries'>, 'eventId' | 'payload'>,
): Promise<string | undefined> => {
  const url = process.env.N8N_REQUEST_WEBHOOK_URL;
  const secret = process.env.CONVEX_TO_N8N_SECRET;
  if (!url || !secret) return 'N8N_NOT_CONFIGURED';

  try {
    const headers = await signedHeaders(
      secret,
      REQUEST_EVENTS_ROUTE,
      delivery.payload,
    );
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-lendloop-event-id': delivery.eventId,
        ...headers,
      },
      body: delivery.payload,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return response.ok ? undefined : `HTTP_${response.status}`;
  } catch (caught) {
    return caught instanceof Error ? caught.name : 'FETCH_FAILED';
  }
};
