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
  const candidates = [
    ...(token?.realm_access?.roles ?? []),
    ...(token?.resource_access?.[clientId]?.roles ?? []),
  ];
  const roles = new Set<UserRole>();
  for (const candidate of candidates) {
    const parsed = userRoleSchema.safeParse(candidate);
    if (parsed.success) roles.add(parsed.data);
  }
  return [...roles];
}
