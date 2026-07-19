import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { CustomerListItem } from '@startflow/contracts';
import { NbaApiService } from '../../core/api/nba-api.service';
import { CustomerListComponent } from './customer-list.component';

describe('CustomerListComponent', () => {
  let api: jasmine.SpyObj<NbaApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<NbaApiService>('NbaApiService', ['searchCustomers']);
    api.searchCustomers.and.resolveTo(customers());

    await TestBed.configureTestingModule({
      imports: [CustomerListComponent],
      providers: [provideRouter([]), { provide: NbaApiService, useValue: api }],
    }).compileComponents();
  });

  it('renders a searchable customer portfolio in the Core table', async () => {
    const fixture = TestBed.createComponent(CustomerListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.searchCustomers).toHaveBeenCalledWith('', 500);
    expect(fixture.componentInstance.customers()).toEqual(customers());
    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.componentInstance.tableOption.columns.map((column) => column.field)).toEqual([
      'full_name',
      'cif_code',
      'product_rank1',
      'last_list_date',
    ]);
  });

  it('searches and opens the canonical customer detail route', async () => {
    const fixture = TestBed.createComponent(CustomerListComponent);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.query.set('CIF-00042');
    await fixture.componentInstance.search();
    fixture.componentInstance.openCustomer(customers()[0]!);

    expect(api.searchCustomers).toHaveBeenCalledWith('CIF-00042', 500);
    expect(navigate).toHaveBeenCalledWith(['/customers', 42]);
  });
});

function customers(): CustomerListItem[] {
  return [
    {
      customer_id: 42,
      full_name: 'Nguyễn Demo An',
      cif_code: 'CIF-00042',
      product_rank1: 'vay',
      last_list_date: '2026-07-19',
    },
  ];
}
