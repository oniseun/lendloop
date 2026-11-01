// Public (browser) config only. Server secrets live on the Convex
// deployment and in n8n, never in Next.js.
export const env = {
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
};
