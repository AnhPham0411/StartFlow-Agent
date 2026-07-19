import type { Route } from '@angular/router';
import { STARTFLOW_PERMISSIONS } from './core/auth/permission-map';
import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  const protectedChildren = (appRoutes.find((route) => route.path === '' && route.children)?.children ??
    []) as Route[];

  it('keeps both canonical and legacy-compatible customer detail routes', () => {
    expect(route('customers')?.data?.['permission']).toBe(STARTFLOW_PERMISSIONS.customerView);
    expect(route('customers/:customerId')?.data?.['permission']).toBe(
      STARTFLOW_PERMISSIONS.customerView,
    );
    expect(route('nba/customers/:customerId')?.data?.['permission']).toBe(
      STARTFLOW_PERMISSIONS.nbaView,
    );
  });

  it('allows managers to read identity administration routes', () => {
    expect(route('administration/branches')?.data?.['permission']).toBe(
      STARTFLOW_PERMISSIONS.branchView,
    );
    expect(route('administration/accounts')?.data?.['permission']).toBe(
      STARTFLOW_PERMISSIONS.accountView,
    );
  });

  it('protects NBA operations with manager access and keeps NBA administration admin-only', () => {
    for (const path of [
      'nba/operations',
      'nba/compliance',
      'nba/tag-qa',
      'nba/models',
      'nba/rag',
      'nba/audit',
    ]) {
      expect(route(path)?.data?.['permission']).toBe(STARTFLOW_PERMISSIONS.nbaOperationsView);
    }
    expect(route('nba/admin/catalog')?.data?.['permission']).toBe(
      STARTFLOW_PERMISSIONS.accountManage,
    );
  });

  function route(path: string): Route | undefined {
    return protectedChildren.find((candidate) => candidate.path === path);
  }
});
