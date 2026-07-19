import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ComparisonResult } from '../../core/api/models';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import { ComparisonComponent } from './comparison.component';

describe('ComparisonComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', [
      'listCases',
      'createComparison',
    ]);
    api.listCases.and.resolveTo([
      {
        id: 'case-1',
        companyName: 'Công ty Minh An Demo',
        registrationNumber: 'DEMO-001',
        requestedAmount: 2_500_000_000,
        purpose: 'Bổ sung vốn lưu động cho đơn hàng demo',
        createdAt: '2026-07-17T08:00:00.000Z',
        latestRun: null,
        runCount: 0,
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ComparisonComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: StartFlowApiService, useValue: api },
      ],
    }).compileComponents();
  });

  it('renders the six frozen metrics in Vietnamese through a Core table', async () => {
    api.createComparison.and.resolveTo(comparisonResult());
    const fixture = TestBed.createComponent(ComparisonComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.compare();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.metricRows().map((row) => row.label)).toEqual([
      'Độ đầy đủ',
      'Phủ căn cứ',
      'Sử dụng công cụ',
      'Phát hiện xung đột',
      'Độ trễ',
      'Điểm rubric',
    ]);
    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Single-agent');
    expect(fixture.nativeElement.textContent).toContain('Multi-agent');
  });

  it('runs a comparison for the selected case and exposes both run links', async () => {
    api.createComparison.and.resolveTo(comparisonResult());
    const fixture = TestBed.createComponent(ComparisonComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.selectCase('case-1');
    await fixture.componentInstance.compare();
    fixture.detectChanges();

    expect(api.createComparison).toHaveBeenCalledOnceWith('case-1');
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toContain('/runs/run-single');
    expect(links.map((link) => link.getAttribute('href'))).toContain('/runs/run-multi');
  });

  it('keeps the case selector recoverable when comparison fails', async () => {
    api.createComparison.and.rejectWith(new Error('offline'));
    const fixture = TestBed.createComponent(ComparisonComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.compare();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không thể chạy phép so sánh');
    expect(fixture.nativeElement.querySelector('sd-select')).not.toBeNull();
  });

  it('uses the responsive control grid without stretching the desktop action', async () => {
    const fixture = TestBed.createComponent(ComparisonComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelector('.comparison-controls');
    expect(controls).not.toBeNull();
    expect(controls.querySelector('.comparison-source')).not.toBeNull();
    expect(controls.querySelector('.comparison-action')).not.toBeNull();
  });
});

function comparisonResult(): ComparisonResult {
  return {
    id: 'comparison-1',
    caseId: 'case-1',
    singleAgentRunId: 'run-single',
    multiAgentRunId: 'run-multi',
    metrics: [
      { name: 'completeness', singleAgent: 55, multiAgent: 90, unit: 'percent' },
      { name: 'citationCoverage', singleAgent: 25, multiAgent: 88, unit: 'percent' },
      { name: 'toolUse', singleAgent: 25, multiAgent: 100, unit: 'percent' },
      { name: 'conflictDetection', singleAgent: 20, multiAgent: 100, unit: 'percent' },
      { name: 'latency', singleAgent: 2.1, multiAgent: 3.6, unit: 'seconds' },
      { name: 'rubricScore', singleAgent: 48, multiAgent: 91, unit: 'points' },
    ],
  };
}
