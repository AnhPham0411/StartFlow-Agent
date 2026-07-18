import type { Routes } from '@angular/router';
import { SdAuthGuard } from '@sdcorejs/angular/modules/auth';
import { SdPermissionGuard } from '@sdcorejs/angular/modules/permission';
import { STARTFLOW_PERMISSIONS } from './core/auth/permission-map';
import { MainLayoutComponent } from './layout/main-layout.component';

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
