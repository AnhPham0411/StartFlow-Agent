'use client';

import { useMemo } from 'react';
import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from './api-client';

export function useStartFlowApi() {
  const { getAccessToken } = useAuth();
  return useMemo(() => new StartFlowApi(getAccessToken), [getAccessToken]);
}
