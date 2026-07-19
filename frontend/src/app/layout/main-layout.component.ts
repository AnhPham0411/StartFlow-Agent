import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  type ElementRef,
  viewChild,
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SdLayoutComponent, type SdLayoutMenu } from '@sdcorejs/angular/modules/layout';
import { STARTFLOW_PERMISSIONS } from '../core/auth/permission-map';
import { filter } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  imports: [SdLayoutComponent, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  readonly #router = inject(Router);
  readonly #liveAnnouncer = inject(LiveAnnouncer);
  private readonly routeMain = viewChild<ElementRef<HTMLElement>>('routeMain');
  #hasCompletedNavigation = this.#router.navigated;

  readonly menus: SdLayoutMenu[] = [
    {
      id: 'business',
      title: 'Nghiệp vụ',
      icon: 'account_balance',
      children: [
        {
          id: 'dashboard',
          path: '/dashboard',
          title: 'Tổng quan',
          icon: 'dashboard',
          permission: STARTFLOW_PERMISSIONS.dashboardView,
        },
        {
          id: 'customers',
          path: '/customers',
          title: 'Khách hàng',
          icon: 'groups',
          permission: STARTFLOW_PERMISSIONS.customerView,
        },
        {
          id: 'nba',
          path: '/nba',
          title: 'Tư vấn NBA',
          icon: 'support_agent',
          permission: STARTFLOW_PERMISSIONS.nbaView,
        },
        {
          id: 'cases',
          path: '/cases',
          title: 'Hồ sơ tín dụng',
          icon: 'folder_open',
          permission: STARTFLOW_PERMISSIONS.caseView,
        },
      ],
    },
    {
      id: 'ai-data',
      title: 'AI & Dữ liệu',
      icon: 'auto_awesome',
      children: [
        {
          id: 'comparisons',
          path: '/comparisons',
          title: 'So sánh mô hình',
          icon: 'compare_arrows',
          permission: STARTFLOW_PERMISSIONS.comparisonView,
        },
        {
          id: 'knowledge',
          path: '/knowledge',
          title: 'Kho tri thức',
          icon: 'menu_book',
          permission: STARTFLOW_PERMISSIONS.knowledgeView,
        },
      ],
    },
    {
      id: 'nba-operations',
      title: 'NBA Operations',
      icon: 'monitor_heart',
      children: [
        {
          id: 'nba-pipeline',
          path: '/nba/operations',
          title: 'Batch & Stages',
          icon: 'account_tree',
          permission: STARTFLOW_PERMISSIONS.nbaOperationsView,
        },
        {
          id: 'nba-compliance',
          path: '/nba/compliance',
          title: 'Compliance',
          icon: 'verified_user',
          permission: STARTFLOW_PERMISSIONS.nbaOperationsView,
        },
        {
          id: 'nba-tag-qa',
          path: '/nba/tag-qa',
          title: 'Tag QA',
          icon: 'fact_check',
          permission: STARTFLOW_PERMISSIONS.nbaOperationsView,
        },
        {
          id: 'nba-models',
          path: '/nba/models',
          title: 'Models',
          icon: 'model_training',
          permission: STARTFLOW_PERMISSIONS.nbaOperationsView,
        },
        {
          id: 'nba-rag',
          path: '/nba/rag',
          title: 'RAG Monitor',
          icon: 'hub',
          permission: STARTFLOW_PERMISSIONS.nbaOperationsView,
        },
        {
          id: 'nba-audit',
          path: '/nba/audit',
          title: 'Audit Explorer',
          icon: 'history',
          permission: STARTFLOW_PERMISSIONS.nbaOperationsView,
        },
      ],
    },
    {
      id: 'nba-administration',
      title: 'NBA Administration',
      icon: 'tune',
      children: [
        {
          id: 'nba-admin-call-lists',
          path: '/nba/admin/call-lists',
          title: 'Call-lists',
          icon: 'call',
          permission: STARTFLOW_PERMISSIONS.accountManage,
        },
        {
          id: 'nba-admin-kpi',
          path: '/nba/admin/kpi',
          title: 'KPI',
          icon: 'monitoring',
          permission: STARTFLOW_PERMISSIONS.accountManage,
        },
        {
          id: 'nba-admin-catalog',
          path: '/nba/admin/catalog',
          title: 'Product Catalog',
          icon: 'inventory_2',
          permission: STARTFLOW_PERMISSIONS.accountManage,
        },
        {
          id: 'nba-admin-geo',
          path: '/nba/admin/geo',
          title: 'Geo',
          icon: 'map',
          permission: STARTFLOW_PERMISSIONS.accountManage,
        },
        {
          id: 'nba-admin-parameters',
          path: '/nba/admin/parameters',
          title: 'Parameters',
          icon: 'settings_suggest',
          permission: STARTFLOW_PERMISSIONS.accountManage,
        },
      ],
    },
    {
      id: 'administration',
      title: 'Quản trị hệ thống',
      icon: 'admin_panel_settings',
      children: [
        {
          id: 'branches',
          path: '/administration/branches',
          title: 'Chi nhánh',
          icon: 'account_tree',
          permission: STARTFLOW_PERMISSIONS.branchView,
        },
        {
          id: 'accounts',
          path: '/administration/accounts',
          title: 'Tài khoản',
          icon: 'manage_accounts',
          permission: STARTFLOW_PERMISSIONS.accountView,
        },
      ],
    },
  ];

  constructor() {
    this.#router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        const shouldMoveFocus = this.#hasCompletedNavigation;
        this.#hasCompletedNavigation = true;
        const title = activeRouteTitle(this.#router);
        void this.#liveAnnouncer.announce(`Đã chuyển đến trang ${title}.`, 'polite');
        if (shouldMoveFocus) {
          queueMicrotask(() => this.routeMain()?.nativeElement.focus());
        }
      });
  }
}

function activeRouteTitle(router: Router): string {
  let route = router.routerState.snapshot.root;
  while (route.firstChild) route = route.firstChild;
  return typeof route.title === 'string' ? route.title : 'StartFlow';
}
