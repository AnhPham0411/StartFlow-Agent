import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import { IngestDrawerComponent } from './ingest-drawer.component';

describe('IngestDrawerComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;
  let notify: jasmine.SpyObj<SdNotifyService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', ['ingestKnowledge']);
    notify = jasmine.createSpyObj<SdNotifyService>('SdNotifyService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [IngestDrawerComponent],
      providers: [
        provideNoopAnimations(),
        { provide: StartFlowApiService, useValue: api },
        { provide: SdNotifyService, useValue: notify },
      ],
    }).compileComponents();
  });

  it('blocks titles under 3 characters and content under 20 characters', async () => {
    const fixture = TestBed.createComponent(IngestDrawerComponent);
    fixture.detectChanges();
    fixture.componentInstance.setTitle('AB');
    fixture.componentInstance.setContent('Quá ngắn');

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(api.ingestKnowledge).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
    expect(fixture.componentInstance.contentError()).toBe('Nội dung cần ít nhất 20 ký tự.');
  });

  it('opens as a labeled modal, closes on Escape, and restores focus', async () => {
    const fixture = TestBed.createComponent(IngestDrawerComponent);
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.open();
    fixture.detectChanges();
    await nextAnimationFrame();

    const drawer = document.querySelector<HTMLElement>(
      '[data-autoid="components-side-drawer-knowledge-ingest"]',
    );
    expect(drawer?.getAttribute('role')).toBe('dialog');
    expect(drawer?.getAttribute('aria-modal')).toBe('true');
    expect(drawer?.getAttribute('aria-labelledby')).toBe('knowledge-ingest-dialog-title');

    drawer?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    fixture.detectChanges();

    expect(drawer?.dataset['opened']).toBe('false');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('submits the normalized admin payload, notifies, and emits the created document', async () => {
    const created = {
      id: 'doc-1',
      title: 'Chính sách tín dụng demo',
      domain: 'credit',
      chunkCount: 2,
      status: 'PROCESSING' as const,
      createdAt: '2026-07-19T09:00:00.000Z',
      demoData: true,
    };
    api.ingestKnowledge.and.resolveTo(created);
    const fixture = TestBed.createComponent(IngestDrawerComponent);
    const ingested = jasmine.createSpy('ingested');
    fixture.componentInstance.ingested.subscribe(ingested);
    fixture.detectChanges();

    fixture.componentInstance.setTitle('  Chính sách tín dụng demo  ');
    fixture.componentInstance.setDomain('CREDIT');
    fixture.componentInstance.setContent(
      '  Nội dung chính sách mô phỏng đủ dài để tạo các đoạn tri thức.  ',
    );
    await fixture.componentInstance.submit();

    expect(api.ingestKnowledge).toHaveBeenCalledOnceWith({
      title: 'Chính sách tín dụng demo',
      domain: 'CREDIT',
      content: 'Nội dung chính sách mô phỏng đủ dài để tạo các đoạn tri thức.',
      demoData: true,
    });
    expect(notify.success).toHaveBeenCalled();
    expect(ingested).toHaveBeenCalledOnceWith(created);
  });
});

async function nextAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
