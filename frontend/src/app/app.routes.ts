import type { Route, Routes } from '@angular/router';
import { SdAuthGuard } from '@sdcorejs/angular/modules/auth';
import { SdPermissionGuard } from '@sdcorejs/angular/modules/permission';
import { STARTFLOW_PERMISSIONS } from './core/auth/permission-map';
import { MainLayoutComponent } from './layout/main-layout.component';

const NBA_CONSOLE_ROUTES: Routes = [
  nbaConsoleRoute('nba/operations', 'NBA Operations', 'operations', STARTFLOW_PERMISSIONS.nbaOperationsView),
  nbaConsoleRoute('nba/compliance', 'NBA Compliance', 'compliance', STARTFLOW_PERMISSIONS.nbaOperationsView),
  nbaConsoleRoute('nba/tag-qa', 'NBA Tag QA', 'tag-qa', STARTFLOW_PERMISSIONS.nbaOperationsView),
  nbaConsoleRoute('nba/models', 'NBA Model Governance', 'models', STARTFLOW_PERMISSIONS.nbaOperationsView),
  nbaConsoleRoute('nba/rag', 'NBA RAG Monitor', 'rag', STARTFLOW_PERMISSIONS.nbaOperationsView),
  nbaConsoleRoute('nba/audit', 'NBA Audit Explorer', 'audit', STARTFLOW_PERMISSIONS.nbaOperationsView),
  nbaConsoleRoute(
    'nba/admin/call-lists',
    'NBA Call-list Administration',
    'call-lists',
    STARTFLOW_PERMISSIONS.accountManage,
  ),
  nbaConsoleRoute('nba/admin/kpi', 'NBA KPI Configuration', 'kpi', STARTFLOW_PERMISSIONS.accountManage),
  nbaConsoleRoute(
    'nba/admin/catalog',
    'NBA Product Catalog',
    'catalog',
    STARTFLOW_PERMISSIONS.accountManage,
  ),
  nbaConsoleRoute('nba/admin/geo', 'NBA Geo Configuration', 'geo', STARTFLOW_PERMISSIONS.accountManage),
  nbaConsoleRoute(
    'nba/admin/parameters',
    'NBA Parameters',
    'parameters',
    STARTFLOW_PERMISSIONS.accountManage,
  ),
];

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [SdAuthGuard, SdPermissionGuard],
    canActivateChild: [SdPermissionGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Tổng quan',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (component) => component.DashboardComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.dashboardView },
      },
      {
        path: 'customers/:customerId',
        title: 'Customer 360',
        loadComponent: () =>
          import('./features/nba/customer-detail/nba-customer-detail.component').then(
            (component) => component.NbaCustomerDetailComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.customerView },
      },
      {
        path: 'customers',
        title: 'Khách hàng',
        loadComponent: () =>
          import('./features/customers/customer-list.component').then(
            (component) => component.CustomerListComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.customerView },
      },
      {
        path: 'nba/customers/:customerId',
        title: 'Chi tiết khách hàng NBA',
        loadComponent: () =>
          import('./features/nba/customer-detail/nba-customer-detail.component').then(
            (component) => component.NbaCustomerDetailComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.nbaView },
      },
      {
        path: 'nba',
        title: 'Danh sách gọi NBA',
        loadComponent: () =>
          import('./features/nba/call-list/nba-call-list.component').then(
            (component) => component.NbaCallListComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.nbaView },
      },
      ...NBA_CONSOLE_ROUTES,
      {
        path: 'cases/new',
        title: 'Tạo hồ sơ tín dụng',
        loadComponent: () =>
          import('./features/cases/intake/case-intake.component').then(
            (component) => component.CaseIntakeComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.caseCreate },
      },
      {
        path: 'cases/:caseId',
        title: 'Chi tiết hồ sơ tín dụng',
        loadComponent: () =>
          import('./features/cases/detail/case-detail.component').then(
            (component) => component.CaseDetailComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.caseView },
      },
      {
        path: 'cases',
        title: 'Hồ sơ tín dụng',
        loadComponent: () =>
          import('./features/cases/list/case-list.component').then(
            (component) => component.CaseListComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.caseView },
      },
      {
        path: 'runs/:runId',
        title: 'Không gian phân tích',
        loadComponent: () =>
          import('./features/runs/run-workspace.component').then(
            (component) => component.RunWorkspaceComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.runView },
      },
      {
        path: 'comparisons',
        title: 'So sánh mô hình',
        loadComponent: () =>
          import('./features/comparisons/comparison.component').then(
            (component) => component.ComparisonComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.comparisonView },
      },
      {
        path: 'knowledge',
        title: 'Tri thức',
        loadComponent: () =>
          import('./features/knowledge/knowledge.component').then(
            (component) => component.KnowledgeComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.knowledgeView },
      },
      {
        path: 'administration/branches',
        title: 'Quản lý chi nhánh',
        loadComponent: () =>
          import('./features/administration/branches/branch-management.component').then(
            (component) => component.BranchManagementComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.branchView },
      },
      {
        path: 'administration/accounts',
        title: 'Quản lý tài khoản',
        loadComponent: () =>
          import('./features/administration/accounts/account-management.component').then(
            (component) => component.AccountManagementComponent,
          ),
        data: { permission: STARTFLOW_PERMISSIONS.accountView },
      },
      {
        path: 'forbidden',
        title: 'Không có quyền truy cập',
        loadComponent: () =>
          import('./shared/states/forbidden.component').then(
            (component) => component.ForbiddenComponent,
          ),
      },
      {
        path: '**',
        title: 'Không tìm thấy trang',
        loadComponent: () =>
          import('./shared/states/not-found.component').then(
            (component) => component.NotFoundComponent,
          ),
      },
    ],
  },
];

function nbaConsoleRoute(
  path: string,
  title: string,
  console: string,
  permission: string,
): Route {
  return {
    path,
    title,
    loadComponent: () =>
      import('./features/nba/operations/nba-operations-console.component').then(
        (component) => component.NbaOperationsConsoleComponent,
      ),
    data: { permission, console },
  };
}
