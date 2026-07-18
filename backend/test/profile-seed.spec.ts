import {
  PROFILE_SEED_COUNTS,
  PROFILE_SEED_SHA256,
  PROFILE_SEED_TABLES,
  buildTableUpsertSql,
  decodeProfileSeed,
} from '../prisma/profile-seed';

describe('Sales Copilot profile seed', () => {
  it('contains the required functional profile bundle without auth credentials', () => {
    const bundle = decodeProfileSeed();
    const serialized = JSON.stringify(bundle);

    expect(bundle.version).toBe('legacy-profile-bundle-v1');
    expect(bundle.tables.profiles).toHaveLength(500);
    expect(bundle.tables.customers).toHaveLength(500);
    expect(bundle.tables.transactions).toHaveLength(25_031);
    expect(serialized).not.toMatch(/password_hash|postgresql:\/\/|access_token|refresh_token/i);
    expect(bundle.tables.users.every((row) => !('password_hash' in row))).toBe(true);
  });

  it('publishes stable counts and a SHA-256 manifest', () => {
    const bundle = decodeProfileSeed();

    for (const table of PROFILE_SEED_TABLES) {
      expect(bundle.tables[table.name]).toHaveLength(PROFILE_SEED_COUNTS[table.name]);
    }
    expect(PROFILE_SEED_SHA256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('builds conflict-safe upserts without destructive statements', () => {
    for (const table of PROFILE_SEED_TABLES) {
      const sql = buildTableUpsertSql(table);
      expect(sql).toContain('ON CONFLICT');
      expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/i);
      expect(sql).toContain('jsonb_populate_recordset');
    }
  });
});
