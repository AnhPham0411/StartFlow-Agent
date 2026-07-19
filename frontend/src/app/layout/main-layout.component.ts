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
