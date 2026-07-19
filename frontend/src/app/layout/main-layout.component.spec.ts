import { Component } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SD_LAYOUT_CONFIGURATION } from '@sdcorejs/angular/modules/layout';
import { SD_PERMISSION_CONFIGURATION } from '@sdcorejs/angular/modules/permission';
import { MainLayoutComponent } from './main-layout.component';

@Component({ template: '<p>Nội dung kiểm thử</p>' })
class TestRouteComponent {}

describe('MainLayoutComponent', () => {
  let liveAnnouncer: jasmine.SpyObj<LiveAnnouncer>;

  beforeEach(async () => {
    liveAnnouncer = jasmine.createSpyObj<LiveAnnouncer>('LiveAnnouncer', ['announce']);
    liveAnnouncer.announce.and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: TestRouteComponent, title: 'Tổng quan' },
          { path: 'cases', component: TestRouteComponent, title: 'Hồ sơ tín dụng' },
          { path: 'runs/:runId', component: TestRouteComponent, title: 'Không gian phân tích' },
        ]),
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        {
          provide: SD_LAYOUT_CONFIGURATION,
          useValue: {
            sidebar: { version: 1, defaultTitle: 'StartFlow' },
            userInfo: { username: 'demo', fullName: 'Demo Reviewer' },
            signout: () => undefined,
          },
        },
        {
          provide: SD_PERMISSION_CONFIGURATION,
          useValue: { disabled: true, loadPermissions: () => [] },
        },
      ],
    }).compileComponents();
  });

  it('renders the Core UI layout and tab router outlet', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('sd-layout')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('sd-tab-router-outlet')).not.toBeNull();
  });

  it('keeps the approved routes in the permission-aware menu', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    const paths = fixture.componentInstance.menus.map((menu) =>
      'path' in menu ? menu.path : undefined,
    );

    expect(paths).toEqual(['/dashboard', '/nba', '/cases', '/comparisons', '/knowledge']);
  });

  it('focuses semantic main content and announces subsequent route changes in Vietnamese', async () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();

    const main = fixture.nativeElement.querySelector('main') as HTMLElement | null;
    expect(main).not.toBeNull();
    expect(document.activeElement).not.toBe(main);

    await router.navigateByUrl('/cases');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(main);
    expect(liveAnnouncer.announce).toHaveBeenCalledWith(
      'Đã chuyển đến trang Hồ sơ tín dụng.',
      'polite',
    );
  });

  it('re-announces repeated navigations that have the same route title', async () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/runs/1');
    await fixture.whenStable();
    await router.navigateByUrl('/runs/2');
    await fixture.whenStable();

    expect(liveAnnouncer.announce.calls.allArgs()).toEqual([
      ['Đã chuyển đến trang Không gian phân tích.', 'polite'],
      ['Đã chuyển đến trang Không gian phân tích.', 'polite'],
    ]);
  });
});
