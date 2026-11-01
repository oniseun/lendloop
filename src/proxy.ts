import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// First line of defence: signed-out users never reach app pages. The
// authoritative checks (who you are, what you may do) run in Convex.
const isProtectedRoute = createRouteMatcher([
  '/tools(.*)',
  '/my-listings(.*)',
  '/my-requests(.*)',
  '/incoming(.*)',
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
