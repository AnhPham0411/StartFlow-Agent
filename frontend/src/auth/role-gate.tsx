'use client';

import type { UserRole } from '@startflow/contracts';
import type { ReactNode } from 'react';
import { useAuth } from './auth-context';

export function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasRole } = useAuth();
  return hasRole(...allow) ? children : fallback;
}
