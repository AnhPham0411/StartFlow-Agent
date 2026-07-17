import type { KeycloakTokenParsed } from 'keycloak-js';
import { userRoleSchema, type UserRole } from '@startflow/contracts';

export function resolveRoles(token: KeycloakTokenParsed | undefined, clientId: string): UserRole[] {
  const rawRoles = new Set([
    ...(token?.realm_access?.roles ?? []),
    ...(token?.resource_access?.[clientId]?.roles ?? []),
  ]);

  return [...rawRoles].flatMap((role) => {
    const parsed = userRoleSchema.safeParse(role);
    return parsed.success ? [parsed.data] : [];
  });
}
