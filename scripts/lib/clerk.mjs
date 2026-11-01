// Clerk Backend API helpers shared by scripts/e2e-setup.mjs and the
// Docker init container (docker/convex-init.mjs).

const CLERK_API = 'https://api.clerk.com/v1';

// Creates a Clerk keyless (accountless) development app: the same thing
// @clerk/nextjs does on a first `next dev` without keys. Returns
// { publishableKey, secretKey, claimUrl }.
export const createKeylessApp = async () => {
  const response = await fetch(`${CLERK_API}/accountless_applications`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Clerk keyless app creation failed: ${response.status}`);
  }
  const app = await response.json();
  return {
    publishableKey: app.publishable_key,
    secretKey: app.secret_key,
    claimUrl: app.claim_url,
  };
};

// The Clerk Frontend API host is base64-encoded in the publishable key.
export const issuerFromPublishableKey = (publishableKey) =>
  `https://${Buffer.from(publishableKey.split('_')[2], 'base64')
    .toString()
    .replace(/\$$/, '')}`;

export const clerkClient =
  (secretKey) =>
  async (path, init = {}) => {
    const response = await fetch(`${CLERK_API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Clerk ${init.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body.errors?.[0]?.code ?? '')}`,
      );
    }
    return body;
  };

// The "convex" JWT template ConvexProviderWithClerk asks for. Same as
// Clerk's dashboard Convex integration creates.
export const ensureConvexJwtTemplate = async (clerk) => {
  const templates = await clerk('/jwt_templates');
  if (templates.some((template) => template.name === 'convex')) return false;
  await clerk('/jwt_templates', {
    method: 'POST',
    body: JSON.stringify({
      name: 'convex',
      lifetime: 60,
      claims: {
        aud: 'convex',
        name: '{{user.full_name}}',
        given_name: '{{user.first_name}}',
        email: '{{user.primary_email_address}}',
        email_verified: '{{user.email_verified}}',
      },
    }),
  });
  return true;
};
