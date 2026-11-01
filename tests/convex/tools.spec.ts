import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { createTest, signIn } from './setup';

const drill = {
  name: '  Cordless   drill ',
  category: 'power_tools' as const,
  condition: 'good' as const,
  description: 'Two batteries.',
};

describe('tools (server-side RBAC)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('rejects anonymous writes', async () => {
    const t = createTest();
    await expect(t.mutation(api.tools.create, drill)).rejects.toThrow(
      /Sign in/,
    );
  });

  it('public list exposes name and category only', async () => {
    const t = createTest();
    const { as } = await signIn(t, 'amara', 'Amara Okafor');
    await as.mutation(api.tools.create, drill);

    const publicTools = await t.query(api.tools.listPublic, {});
    expect(publicTools).toHaveLength(1);
    expect(Object.keys(publicTools[0]).sort()).toEqual([
      '_id',
      'category',
      'name',
    ]);
    expect(publicTools[0].name).toBe('Cordless drill');
  });

  it('signed-in list shows first name only, never email', async () => {
    const t = createTest();
    const { as } = await signIn(t, 'amara', 'Amara Okafor');
    await as.mutation(api.tools.create, drill);
    const { as: tom } = await signIn(t, 'tom', 'Tom Hughes');

    const [tool] = await tom.query(api.tools.list, {});
    expect(tool.owner).toEqual({ firstName: 'Amara', isTrustedLender: false });
    expect(JSON.stringify(tool)).not.toContain('@example.com');
    expect(tool.isMine).toBe(false);
  });

  it('filters by category', async () => {
    const t = createTest();
    const { as } = await signIn(t, 'amara', 'Amara Okafor');
    await as.mutation(api.tools.create, drill);
    await as.mutation(api.tools.create, {
      ...drill,
      name: 'Rake',
      category: 'garden',
    });
    const garden = await as.query(api.tools.list, { category: 'garden' });
    expect(garden.map((tool) => tool.name)).toEqual(['Rake']);
  });

  it('only the owner can edit', async () => {
    const t = createTest();
    const { as: amara } = await signIn(t, 'amara', 'Amara Okafor');
    const { as: tom } = await signIn(t, 'tom', 'Tom Hughes');
    const { as: admin } = await signIn(t, 'ops', 'Ops Admin', 'admin');
    const toolId = await amara.mutation(api.tools.create, drill);

    await expect(
      tom.mutation(api.tools.update, { toolId, ...drill, name: 'Mine now' }),
    ).rejects.toThrow(/only edit your own/);
    await expect(
      admin.mutation(api.tools.update, {
        toolId,
        ...drill,
        name: 'Admin edit',
      }),
    ).rejects.toThrow(/only edit your own/);

    await amara.mutation(api.tools.update, {
      toolId,
      ...drill,
      name: 'Drill v2',
    });
    const [tool] = await amara.query(api.tools.mine, {});
    expect(tool.name).toBe('Drill v2');
  });

  it('owner or admin can remove; other users cannot', async () => {
    const t = createTest();
    const { as: amara } = await signIn(t, 'amara', 'Amara Okafor');
    const { as: tom } = await signIn(t, 'tom', 'Tom Hughes');
    const { as: admin } = await signIn(t, 'ops', 'Ops Admin', 'admin');
    const first = await amara.mutation(api.tools.create, drill);
    const second = await amara.mutation(api.tools.create, {
      ...drill,
      name: 'Saw',
    });

    await expect(
      tom.mutation(api.tools.remove, { toolId: first }),
    ).rejects.toThrow(/only remove your own/);
    await admin.mutation(api.tools.remove, { toolId: first });
    await amara.mutation(api.tools.remove, { toolId: second });

    expect(await t.query(api.tools.listPublic, {})).toHaveLength(0);
    const removed = await t.run((ctx) => ctx.db.get(first));
    expect(removed?.removedAt).toBeDefined();
  });

  it('validates input on the server', async () => {
    const t = createTest();
    const { as } = await signIn(t, 'amara', 'Amara Okafor');
    await expect(
      as.mutation(api.tools.create, { ...drill, name: 'x' }),
    ).rejects.toThrow(/at least 2/);
    await expect(
      as.mutation(api.tools.create, { ...drill, description: 'a'.repeat(501) }),
    ).rejects.toThrow(/at most 500/);
  });
});
