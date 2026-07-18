import type { KeycloakTokenParsed } from 'keycloak-js';
import { userRoleSchema, type UserRole } from '@startflow/contracts';

export function resolveRoles(token: KeycloakTokenParsed | undefined, clientId: string): UserRole[] {
  const rawRoles = new Set([
    ...(token?.realm_access?.roles ?? []),
    ...(token?.resource_access?.[clientId]?.roles ?? []),
  ]);

  const resolved = [...rawRoles].flatMap((role) => {
    const parsed = userRoleSchema.safeParse(role);
    return parsed.success ? [parsed.data] : [];
  });

  const expanded = new Set<UserRole>(resolved);
  if (expanded.has('analyst')) expanded.add('sale');
  if (expanded.has('approver')) {
    expanded.add('sale');
    expanded.add('manager');
  }
  return [...expanded];
}
