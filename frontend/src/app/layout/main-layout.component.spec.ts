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

  it('renders the Core UI layout through the standard router outlet', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('sd-layout')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('sd-tab-router-outlet')).toBeNull();
    expect(fixture.nativeElement.querySelector('main')?.classList).toContain('app-route-content');
  });

  it('groups permission-aware routes into business and AI navigation', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    const groups = fixture.componentInstance.menus.map((group) => ({
      id: group.id,
      title: group.title,
      paths:
        'children' in group
          ? (group.children ?? []).flatMap((child) => ('path' in child ? [child.path] : []))
          : [],
    }));

    expect(groups).toEqual([
      { id: 'business', title: 'Nghiệp vụ', paths: ['/dashboard', '/cases'] },
      { id: 'ai-data', title: 'AI & Dữ liệu', paths: ['/comparisons', '/knowledge'] },
    ]);
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
