import { readFile } from 'node:fs/promises';

describe('hackathon demo case seed', () => {
  it('ships at least ten distinct business cases for the demo queue', async () => {
    const source = await readFile('prisma/seed.ts', 'utf8');
    const registrations = Array.from(
      source.matchAll(/registrationNumber:\s*'([^']+)'/g),
      (match) => match[1],
    );

    expect(registrations.length).toBeGreaterThanOrEqual(10);
    expect(new Set(registrations).size).toBe(registrations.length);
  });
});
