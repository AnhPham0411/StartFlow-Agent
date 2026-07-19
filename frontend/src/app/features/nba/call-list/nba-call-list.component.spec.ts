import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { NbaCallListEntry } from '../../../core/api/nba.models';
import { NbaApiService } from '../../../core/api/nba-api.service';
import { NbaCallListComponent } from './nba-call-list.component';

describe('NbaCallListComponent', () => {
  let api: jasmine.SpyObj<NbaApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<NbaApiService>('NbaApiService', ['getCallList']);
    api.getCallList.and.resolveTo(callListItems());

    await TestBed.configureTestingModule({
      imports: [NbaCallListComponent],
      providers: [provideRouter([]), { provide: NbaApiService, useValue: api }],
    }).compileComponents();
  });

  it('renders the demo snapshot and Top 2 recommendation columns in the Core table', async () => {
    const fixture = TestBed.createComponent(NbaCallListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('snapshot demo');
    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.componentInstance.tableOption.columns.map((column) => column.field)).toEqual(
      jasmine.arrayContaining([
        'name',
        'cif_code',
        'product_rank1',
        'score_rank1',
        'product_rank2',
        'score_rank2',
        'rec_version',
      ]),
    );
    expect(fixture.componentInstance.items().length).toBe(2);
  });

  it('reloads the call list when the selected date changes', async () => {
    const fixture = TestBed.createComponent(NbaCallListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.changeDate('2026/07/20');

    expect(api.getCallList).toHaveBeenCalledWith('2026-07-20');
  });

  it('keeps API refresh owned by the page instead of the recursive Core reload callback', async () => {
    const fixture = TestBed.createComponent(NbaCallListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.tableOption.reload?.onReload).toBeUndefined();
    expect(
      fixture.nativeElement.querySelector('[data-autoid$="nba-call-list-refresh"]'),
    ).not.toBeNull();
  });

  it('opens the approved customer detail route', async () => {
    const fixture = TestBed.createComponent(NbaCallListComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.openCustomer(callListItems()[0]!);

    expect(navigateSpy).toHaveBeenCalledWith(['/nba/customers', 42]);
  });

  it('shows a recoverable error when the call list cannot be loaded', async () => {
    api.getCallList.and.rejectWith(new Error('offline'));
    const fixture = TestBed.createComponent(NbaCallListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không tải được danh sách gọi');
    expect(fixture.nativeElement.querySelector('app-error-state')).not.toBeNull();
  });

  it('keeps a visible loading state while the request is pending', () => {
    api.getCallList.and.returnValue(new Promise(() => undefined));
    const fixture = TestBed.createComponent(NbaCallListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đang tải danh sách gọi');
    fixture.destroy();
  });
});

function callListItems(): NbaCallListEntry[] {
  return [
    {
      customer_id: 42,
      name: 'Nguyễn Demo An',
      cif_code: 'CIF-00042',
      product_rank1: 'vay',
      score_rank1: 0.91,
      product_rank2: 'the',
      score_rank2: 0.76,
      rec_id: '123',
      rec_version: 3,
    },
    {
      customer_id: 43,
      name: 'Trần Demo Bình',
      cif_code: 'CIF-00043',
      product_rank1: 'dautu',
      score_rank1: 0.82,
      product_rank2: 'baohiem',
      score_rank2: 0.7,
      rec_id: '124',
      rec_version: 2,
    },
  ];
}
