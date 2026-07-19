import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SD_PERMISSION_CONFIGURATION } from '@sdcorejs/angular/modules/permission';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import { KnowledgeComponent } from './knowledge.component';

describe('KnowledgeComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', ['listKnowledge']);
    api.listKnowledge.and.resolveTo([
      {
        id: 'doc-1',
        title: 'Chính sách tín dụng demo',
        domain: 'credit',
        chunkCount: 4,
        status: 'READY',
        createdAt: '2026-07-19T08:00:00.000Z',
        demoData: true,
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [KnowledgeComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: StartFlowApiService, useValue: api },
        {
          provide: SD_PERMISSION_CONFIGURATION,
          useValue: { disabled: true, loadPermissions: () => [] },
        },
      ],
    }).compileComponents();
  });

  it('renders the admin knowledge list with Core table and status badge', fakeAsync(() => {
    const fixture = TestBed.createComponent(KnowledgeComponent);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    tick(250);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('sd-badge')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Chính sách tín dụng demo');
    expect(fixture.nativeElement.textContent).toContain('Sẵn sàng');
  }));

  it('shows a recoverable error when the document list cannot load', async () => {
    api.listKnowledge.and.rejectWith(new Error('offline'));
    const fixture = TestBed.createComponent(KnowledgeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không tải được thư viện tri thức demo');
    expect(fixture.nativeElement.querySelector('app-error-state')).not.toBeNull();
  });

  it('refreshes the document list after an ingest completes', async () => {
    const fixture = TestBed.createComponent(KnowledgeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    api.listKnowledge.calls.reset();

    await fixture.componentInstance.onIngested();

    expect(api.listKnowledge).toHaveBeenCalledTimes(1);
  });
});
