// Optional: when E2E_MAILPIT_URL is set (n8n + Mailpit running), the
// suite also checks the emails n8n sent.

export const mailpitUrl = () => process.env.E2E_MAILPIT_URL;

export interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Snippet: string;
}

export const findEmail = async (
  to: string,
  contains: string,
): Promise<MailpitMessage | null> => {
  const query = encodeURIComponent(`to:"${to}" ${JSON.stringify(contains)}`);
  const response = await fetch(`${mailpitUrl()}/api/v1/search?query=${query}`);
  const body = (await response.json()) as { messages: MailpitMessage[] };
  return body.messages[0] ?? null;
};
