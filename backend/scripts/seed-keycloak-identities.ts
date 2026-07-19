import { PrismaClient } from '@prisma/client';

import { buildOperationalUserSeedRows, decodeProfileSeed } from '../prisma/profile-seed';

interface RealmRole {
  id: string;
  name: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.STARTFLOW_ENABLE_IDENTITY_SEED !== 'true'
  ) {
    throw new Error('Production identity seed requires STARTFLOW_ENABLE_IDENTITY_SEED=true');
  }
  const issuer = required('KEYCLOAK_ISSUER').replace(/\/$/, '');
  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID?.trim() || 'INTEGRATION_API';
  const clientSecret = required('KEYCLOAK_ADMIN_CLIENT_SECRET');
  const initialPassword = required('STARTFLOW_DEMO_INITIAL_PASSWORD');
  const realmMarker = '/realms/';
  const markerIndex = issuer.indexOf(realmMarker);
  if (markerIndex < 0) throw new Error('KEYCLOAK_ISSUER must contain /realms/{realm}');
  const realm = issuer.slice(markerIndex + realmMarker.length);
  const adminBase = `${issuer.slice(0, markerIndex)}/admin/realms/${encodeURIComponent(realm)}`;

  const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  if (!tokenResponse.ok) throw new Error('Keycloak admin authentication failed');
  const tokenPayload = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof tokenPayload.access_token !== 'string') throw new Error('Keycloak token is missing');

  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    const response = await fetch(`${adminBase}${path}`, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${tokenPayload.access_token}` },
    });
    if (!response.ok) throw new Error(`Keycloak identity operation failed (${response.status})`);
    return response;
  };

  for (const name of ['employee', 'manager', 'admin']) {
    const response = await fetch(`${adminBase}/roles/${name}`, {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` },
    });
    if (response.status === 404) {
      await request('/roles', {
        body: JSON.stringify({ name }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    } else if (!response.ok) {
      throw new Error(`Keycloak role lookup failed (${response.status})`);
    }
  }
  const roles = (await (await request('/roles')).json()) as RealmRole[];

  const prisma = new PrismaClient();
  try {
    const users = buildOperationalUserSeedRows(decodeProfileSeed().tables.users);
    for (const user of users) {
      let matches = (await (
        await request(`/users?exact=true&username=${encodeURIComponent(user.username)}`)
      ).json()) as Array<{ id: string }>;
      let keycloakId = matches[0]?.id;
      if (!keycloakId) {
        const created = await request('/users', {
          body: JSON.stringify({
            credentials: [{ temporary: true, type: 'password', value: initialPassword }],
            enabled: true,
            firstName: String(user.full_name),
            requiredActions: ['UPDATE_PASSWORD'],
            username: user.username,
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        keycloakId = created.headers.get('location')?.split('/').pop();
        if (!keycloakId) {
          matches = (await (
            await request(`/users?exact=true&username=${encodeURIComponent(user.username)}`)
          ).json()) as Array<{ id: string }>;
          keycloakId = matches[0]?.id;
        }
      } else {
        await request(`/users/${encodeURIComponent(keycloakId)}`, {
          body: JSON.stringify({ enabled: true, firstName: String(user.full_name) }),
          headers: { 'content-type': 'application/json' },
          method: 'PUT',
        });
      }
      if (!keycloakId) throw new Error('Keycloak user id was not returned');

      const currentRoles = (await (
        await request(`/users/${encodeURIComponent(keycloakId)}/role-mappings/realm`)
      ).json()) as RealmRole[];
      const obsolete = currentRoles.filter((role) =>
        ['employee', 'manager', 'admin', 'sale', 'analyst', 'approver'].includes(role.name),
      );
      if (obsolete.length) {
        await request(`/users/${encodeURIComponent(keycloakId)}/role-mappings/realm`, {
          body: JSON.stringify(obsolete),
          headers: { 'content-type': 'application/json' },
          method: 'DELETE',
        });
      }
      const selected = roles.find((role) => role.name === user.role);
      if (!selected) throw new Error('Canonical Keycloak role is missing');
      await request(`/users/${encodeURIComponent(keycloakId)}/role-mappings/realm`, {
        body: JSON.stringify([selected]),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const updated = await prisma.$executeRawUnsafe(
        `UPDATE users SET keycloak_user_id=$2, updated_at=now() WHERE username=$1`,
        user.username,
        keycloakId,
      );
      if (updated !== 1) throw new Error('Operational account is missing from PostgreSQL');
    }
    process.stdout.write(`Identity seed ready: ${users.length} accounts synchronized.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write('Identity seed failed; credentials and account details were suppressed.\n');
  process.exitCode = 1;
});
