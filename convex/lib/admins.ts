// First-admin bootstrap: emails in ADMIN_EMAILS (comma separated, set on
// the Convex deployment) get the admin role on first sign-in, but only if
// Clerk says the address is verified. After that, roles are changed with
// `npx convex run users:setRole`.
export const shouldBootstrapAdmin = (
  email: string | undefined,
  emailVerified: boolean | undefined,
  adminEmails: string | undefined,
) => {
  if (!email || !emailVerified || !adminEmails) return false;
  const allowed = adminEmails
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
};
