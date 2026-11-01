import { api } from '@convex/_generated/api';

// Convex function references for the tools module. Components and
// hooks import from here, never from the generated api directly, so the
// backend surface a module uses is listed in one place.
export const toolApi = {
  listPublic: api.tools.listPublic,
  list: api.tools.list,
  mine: api.tools.mine,
  create: api.tools.create,
  update: api.tools.update,
  remove: api.tools.remove,
};
