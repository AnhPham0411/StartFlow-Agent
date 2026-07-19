import { normalizeUserRole, type UserRole } from '@startflow/contracts';

export interface StartFlowTokenClaims {
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: unknown[] };
  resource_access?: Record<string, { roles?: unknown[] } | undefined>;
}

export function resolveRoles(
  token: StartFlowTokenClaims | undefined,
  clientId: string,
): UserRole[] {
  const realmManagementRoles = token?.resource_access?.['realm-management']?.roles ?? [];
  const candidates = [
    ...(token?.realm_access?.roles ?? []),
    ...(token?.resource_access?.[clientId]?.roles ?? []),
    ...realmManagementRoles,
  ];
  const roles = new Set<UserRole>();
  for (const candidate of candidates) {
    const role = normalizeUserRole(candidate);
    if (role) roles.add(role);
  }

  if (realmManagementRoles.includes('realm-admin')) roles.add('admin');

  return [...roles];
}
