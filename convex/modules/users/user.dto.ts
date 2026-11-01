import type { Doc } from '../../_generated/dataModel';
import { firstName } from '../../lib/text';

// Response shapes for user data. Other neighbours only ever see a
// first name and the trusted-lender badge.

export const toMeDto = (user: Doc<'users'>) => ({
  _id: user._id,
  name: user.name,
  role: user.role,
  isTrustedLender: user.isTrustedLender,
});

export const toNeighbourDto = (user: Doc<'users'>) => ({
  firstName: firstName(user.name),
  isTrustedLender: user.isTrustedLender,
});

export type MeDto = ReturnType<typeof toMeDto>;
export type NeighbourDto = ReturnType<typeof toNeighbourDto>;
