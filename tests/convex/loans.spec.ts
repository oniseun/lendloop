import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { createTest, signIn, type TestConvex } from './setup';

const drill = {
  name: 'Cordless drill',
  category: 'power_tools' as const,
  condition: 'good' as const,
  description: 'Two batteries.',
};

const setup = async (t: TestConvex) => {
  const amara = await signIn(t, 'amara', 'Amara Okafor');
  const tom = await signIn(t, 'tom', 'Tom Hughes');
  const priya = await signIn(t, 'priya', 'Priya Shah');
  const admin = await signIn(t, 'ops', 'Ops Admin', 'admin');
  const toolId = await amara.as.mutation(api.tools.create, drill);
  return { amara, tom, priya, admin, toolId };
};

describe('loans (server-side RBAC and rules)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    delete process.env.N8N_REQUEST_WEBHOOK_URL;
  });
  afterEach(() => vi.useRealTimers());

  it('owners cannot borrow their own tool', async () => {
    const t = createTest();
    const { amara, toolId } = await setup(t);
    await expect(
      amara.as.mutation(api.loans.request, {
        toolId,
        startDate: '2026-11-02',
        endDate: '2026-11-03',
      }),
    ).rejects.toThrow(/your own tool/);
  });

  it('runs the full happy path: request, approve, return', async () => {
    const t = createTest();
    const { amara, tom, toolId } = await setup(t);
    const loanId = await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      message: 'For shelves',
    });

    const [incoming] = await amara.as.query(api.loans.incoming, {});
    expect(incoming.status).toBe('pending');
    expect(incoming.borrower).toEqual({ firstName: 'Tom' });

    await amara.as.mutation(api.loans.approve, { loanId });
    const [tool] = await tom.as.query(api.tools.list, {});
    expect(tool.availability).toBe('on_loan');

    await amara.as.mutation(api.loans.markReturned, { loanId });
    const [mine] = await tom.as.query(api.loans.mine, {});
    expect(mine.status).toBe('returned');
  });

  it('only the lender can approve, decline or mark returned', async () => {
    const t = createTest();
    const { amara, tom, priya, admin, toolId } = await setup(t);
    const loanId = await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-02',
      endDate: '2026-11-03',
    });

    for (const actor of [tom, priya, admin]) {
      await expect(
        actor.as.mutation(api.loans.approve, { loanId }),
      ).rejects.toThrow(/cannot act on this request/);
      await expect(
        actor.as.mutation(api.loans.decline, { loanId }),
      ).rejects.toThrow(/cannot act on this request/);
    }

    await amara.as.mutation(api.loans.approve, { loanId });
    await expect(
      tom.as.mutation(api.loans.markReturned, { loanId }),
    ).rejects.toThrow(/cannot act on this request/);
  });

  it('only the borrower can cancel, and only while pending', async () => {
    const t = createTest();
    const { amara, tom, toolId } = await setup(t);
    const loanId = await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-02',
      endDate: '2026-11-03',
    });
    await expect(
      amara.as.mutation(api.loans.cancel, { loanId }),
    ).rejects.toThrow(/cannot act on this request/);
    await tom.as.mutation(api.loans.cancel, { loanId });
    await expect(tom.as.mutation(api.loans.cancel, { loanId })).rejects.toThrow(
      /Cannot cancel a cancelled request/,
    );
  });

  it('blocks double-booking and declines clashing requests on approve', async () => {
    const t = createTest();
    const { amara, tom, priya, toolId } = await setup(t);
    const tomLoan = await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-02',
      endDate: '2026-11-05',
    });
    const priyaLoan = await priya.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-04',
      endDate: '2026-11-06',
    });

    await amara.as.mutation(api.loans.approve, { loanId: tomLoan });
    const clash = await t.run((ctx) => ctx.db.get(priyaLoan));
    expect(clash?.status).toBe('declined');

    await expect(
      priya.as.mutation(api.loans.request, {
        toolId,
        startDate: '2026-11-05',
        endDate: '2026-11-07',
      }),
    ).rejects.toThrow(/already booked/);
  });

  it('rejects duplicate pending requests', async () => {
    const t = createTest();
    const { tom, toolId } = await setup(t);
    const range = { toolId, startDate: '2026-11-02', endDate: '2026-11-03' };
    await tom.as.mutation(api.loans.request, range);
    await expect(tom.as.mutation(api.loans.request, range)).rejects.toThrow(
      /already have a pending request/,
    );
  });

  it('owners cannot delete a listing that is out on loan', async () => {
    const t = createTest();
    const { amara, tom, admin, toolId } = await setup(t);
    const loanId = await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    });
    await amara.as.mutation(api.loans.approve, { loanId });
    await expect(
      amara.as.mutation(api.tools.remove, { toolId }),
    ).rejects.toThrow(/returned first/);
    // Moderation still works.
    await admin.as.mutation(api.tools.remove, { toolId });
  });

  it('admin sees all loans; users cannot call admin functions', async () => {
    const t = createTest();
    const { tom, priya, admin, toolId } = await setup(t);
    await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-02',
      endDate: '2026-11-03',
    });
    expect(await admin.as.query(api.admin.loans, {})).toHaveLength(1);
    await expect(priya.as.query(api.admin.loans, {})).rejects.toThrow(
      /Admins only/,
    );
    await expect(
      priya.as.mutation(api.admin.setTrustedLender, {
        userId: priya.userId,
        trusted: true,
      }),
    ).rejects.toThrow(/Admins only/);
  });

  it('admin can mark a trusted lender and it shows on listings', async () => {
    const t = createTest();
    const { amara, tom, admin } = await setup(t);
    await admin.as.mutation(api.admin.setTrustedLender, {
      userId: amara.userId,
      trusted: true,
    });
    const [tool] = await tom.as.query(api.tools.list, {});
    expect(tool.owner?.isTrustedLender).toBe(true);
  });

  it('a user only sees loans they are part of', async () => {
    const t = createTest();
    const { amara, tom, priya, toolId } = await setup(t);
    await tom.as.mutation(api.loans.request, {
      toolId,
      startDate: '2026-11-02',
      endDate: '2026-11-03',
    });
    expect(await priya.as.query(api.loans.mine, {})).toHaveLength(0);
    expect(await priya.as.query(api.loans.incoming, {})).toHaveLength(0);
    expect(await amara.as.query(api.loans.incoming, {})).toHaveLength(1);
  });
});
