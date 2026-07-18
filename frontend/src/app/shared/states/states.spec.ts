import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { SdLoadingService } from '@sdcorejs/angular/services/loading';
import { EmptyStateComponent } from './empty-state.component';
import { ErrorStateComponent } from './error-state.component';
import { ForbiddenComponent } from './forbidden.component';
import { LoadingStateComponent } from './loading-state.component';
import { NotFoundComponent } from './not-found.component';

describe('shared states', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('announces loading state accessibly', () => {
    const loadingService = TestBed.inject(SdLoadingService);
    const startSpy = spyOn(loadingService, 'start').and.callThrough();
    const stopSpy = spyOn(loadingService, 'stop').and.callThrough();
    const fixture = TestBed.createComponent(LoadingStateComponent);
    fixture.componentRef.setInput('label', 'Đang tải hồ sơ…');
    fixture.detectChanges();

    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status.nativeElement.textContent).toContain('Đang tải hồ sơ');
    expect(status.attributes['aria-live']).toBe('polite');
    expect(fixture.debugElement.query(By.css('.sd-loading'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('sd-badge'))).toBeNull();
    expect(startSpy).toHaveBeenCalledOnceWith(jasmine.stringMatching(/^#startflow-loading-/));
    const loadingSelector = startSpy.calls.first().args[0] ?? '#missing-loading-state';

    fixture.destroy();
    expect(stopSpy).toHaveBeenCalledOnceWith(loadingSelector);
  });

  it('renders an actionable empty state and emits its primary action', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    const actionSpy = jasmine.createSpy('action');
    fixture.componentRef.setInput('title', 'Chưa có hồ sơ');
    fixture.componentRef.setInput('actionLabel', 'Tạo hồ sơ');
    fixture.componentInstance.primaryAction.subscribe(actionSpy);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('sd-inform'))
      .triggerEventHandler('sdAction', new Event('click'));
    expect(fixture.nativeElement.textContent).toContain('Chưa có hồ sơ');
    expect(actionSpy).toHaveBeenCalled();
  });

  it('renders a recoverable error and emits retry', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    const retrySpy = jasmine.createSpy('retry');
    fixture.componentInstance.retry.subscribe(retrySpy);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('sd-inform'))
      .triggerEventHandler('sdAction', new Event('click'));
    expect(fixture.nativeElement.textContent).toContain('Không tải được dữ liệu');
    expect(retrySpy).toHaveBeenCalled();
  });

  it('provides clear forbidden and not-found routes back to the portal', () => {
    const forbidden = TestBed.createComponent(ForbiddenComponent);
    const notFound = TestBed.createComponent(NotFoundComponent);
    forbidden.detectChanges();
    notFound.detectChanges();

    expect(forbidden.nativeElement.textContent).toContain('không có quyền');
    expect(notFound.nativeElement.textContent).toContain('không tồn tại');
    expect(notFound.nativeElement.querySelector('a').getAttribute('href')).toBe('/dashboard');
  });
});
