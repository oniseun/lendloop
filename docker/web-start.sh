#!/bin/sh
# Builds and starts Next.js. The build happens here rather than in the
# image because the Clerk keys may only exist at runtime (keyless app
# created by convex-init), and NEXT_PUBLIC_* values are fixed at build.
set -eu
set -a
. /shared/app.env
set +a
if [ ! -f .next/BUILD_ID ] || [ "$(cat .next/.built-for 2>/dev/null)" != "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
  npm run build
  echo "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" > .next/.built-for
fi
exec npm run start -- -p 3000 -H 0.0.0.0
