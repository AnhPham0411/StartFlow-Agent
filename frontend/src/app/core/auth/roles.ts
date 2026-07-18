import { userRoleSchema, type UserRole } from '@startflow/contracts';

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
    const parsed = userRoleSchema.safeParse(candidate);
    if (parsed.success) roles.add(parsed.data);
  }

  if (realmManagementRoles.includes('realm-admin')) roles.add('admin');
  if (roles.has('analyst')) roles.add('sale');
  if (roles.has('approver')) {
    roles.add('sale');
    roles.add('manager');
  }

  return [...roles];
}
