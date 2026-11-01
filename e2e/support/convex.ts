import { execFileSync } from 'node:child_process';

// Runs a gated fixture from convex/e2e.ts on the local deployment.
export const runFixture = <T>(name: string, args: object): T => {
  const output = execFileSync(
    'npx',
    ['convex', 'run', `e2e:${name}`, JSON.stringify(args)],
    { encoding: 'utf8', env: { ...process.env } },
  );
  return JSON.parse(output.slice(output.indexOf('{')));
};
