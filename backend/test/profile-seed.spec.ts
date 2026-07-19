import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PROFILE_SEED_COUNTS,
  PROFILE_SEED_SHA256,
  PROFILE_SEED_TABLES,
  buildOperationalUserSeedRows,
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

  it('transforms the immutable bundle into the approved three-level branch model', () => {
    const rows = buildOperationalUserSeedRows(decodeProfileSeed().tables.users);

    expect(rows).toHaveLength(30);
    expect(rows.find((row) => row.username === 'user017')).toMatchObject({
      id: 17,
      role: 'admin',
      branch: null,
      branch_id: null,
    });
    expect(rows.find((row) => row.username === 'user006')).toMatchObject({
      id: 6,
      role: 'manager',
      branch_id: 1,
    });
    expect(rows.find((row) => row.username === 'user001')).toMatchObject({
      id: 1,
      role: 'employee',
      branch_id: 1,
    });
    expect(new Set(rows.map((row) => row.branch_id).filter(Boolean)).size).toBe(10);
  });

  it('builds conflict-safe upserts without destructive statements', () => {
    for (const table of PROFILE_SEED_TABLES) {
      const sql = buildTableUpsertSql(table);
      expect(sql).toContain('ON CONFLICT');
      expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/i);
      expect(sql).toContain('jsonb_populate_recordset');
    }
  });

  it('migrates every geo enum value contained in the profile bundle', () => {
    const bundle = decodeProfileSeed();
    const migrationSql = [
      '../prisma/migrations/20260718190000_sales_copilot_profile_bundle/migration.sql',
      '../prisma/migrations/20260718200000_extend_zone_type_for_profile_seed/migration.sql',
    ]
      .map((path) => readFileSync(join(__dirname, path), 'utf8'))
      .join('\n');
    const zoneTypes = new Set([
      ...bundle.tables.zone_registry.map((row) => row.zone_type),
      ...bundle.tables.customer_geo.map((row) => row.zone_type),
    ]);

    for (const zoneType of zoneTypes) {
      expect(migrationSql).toContain(`'${String(zoneType)}'`);
    }

    for (const matchMethod of new Set(bundle.tables.customer_geo.map((row) => row.match_method))) {
      expect(migrationSql).toContain(`'${String(matchMethod)}'`);
    }
  });

  it('adds the branch model and enforces the approved role/branch invariant', () => {
    const migrationSql = [
      '../prisma/migrations/20260719093000_identity_branch_rbac/migration.sql',
      '../prisma/migrations/20260719094000_identity_branch_accounts/migration.sql',
    ]
      .map((path) => readFileSync(join(__dirname, path), 'utf8'))
      .join('\n');

    expect(migrationSql).toContain("ADD VALUE IF NOT EXISTS 'employee'");
    expect(migrationSql).toContain('CREATE TABLE branches');
    expect(migrationSql).toContain('users_role_branch_check');
    expect(migrationSql).toContain("role = 'admin'::user_role AND branch_id IS NULL");
    expect(migrationSql).toContain("'employee'::user_role) AND branch_id IS NOT NULL");
    expect(migrationSql).not.toMatch(/DROP TABLE users|TRUNCATE users/i);
  });
});
