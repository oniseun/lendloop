import { api } from '@convex/_generated/api';

// Convex function references for the admin module. Every one of these
// is rejected server-side for non-admins.
export const adminApi = {
  loans: api.admin.loans,
  users: api.admin.users,
  setTrustedLender: api.admin.setTrustedLender,
  failedDeliveries: api.admin.failedDeliveries,
  retryDelivery: api.admin.retryDelivery,
};
