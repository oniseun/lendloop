import { v } from 'convex/values';

export const roleValidator = v.union(v.literal('admin'), v.literal('user'));

export const categoryValidator = v.union(
  v.literal('power_tools'),
  v.literal('hand_tools'),
  v.literal('garden'),
  v.literal('kitchen'),
  v.literal('camping'),
  v.literal('cleaning'),
  v.literal('other'),
);

export const conditionValidator = v.union(
  v.literal('new'),
  v.literal('good'),
  v.literal('fair'),
  v.literal('worn'),
);

export const loanStatusValidator = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('declined'),
  v.literal('cancelled'),
  v.literal('returned'),
);

export const automationKindValidator = v.union(
  v.literal('request_notification'),
  v.literal('overdue_reminder'),
);

export const automationStatusValidator = v.union(
  v.literal('queued'),
  v.literal('sent'),
  v.literal('failed'),
);

export const deliveryStatusValidator = v.union(
  v.literal('pending'),
  v.literal('delivered'),
  v.literal('failed'),
);
