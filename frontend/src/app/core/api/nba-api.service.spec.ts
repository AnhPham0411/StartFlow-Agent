import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { NbaApiService } from './nba-api.service';

describe('NbaApiService', () => {
  let api: NbaApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NbaApiService,
        {
          provide: APP_ENVIRONMENT,
          useValue: {
            production: true,
            apiUrl: 'https://api.startflow.test/api',
            authMode: 'keycloak',
            keycloakUrl: 'https://identity.startflow.test',
            keycloakRealm: 'startflow',
            keycloakClientId: 'startflow-web',
          },
        },
        {
          provide: AuthStateService,
          useValue: { getAccessToken: () => Promise.resolve('nba-token') },
        },
      ],
    });
    api = TestBed.inject(NbaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches the scoped customer portfolio with the frozen query contract', async () => {
    const resultPromise = api.searchCustomers('demo', 50);
    await Promise.resolve();

    const request = http.expectOne(
      'https://api.startflow.test/api/nba/customers?q=demo&limit=50',
    );
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        customer_id: 42,
        full_name: 'Nguyen Demo An',
        cif_code: 'CIF-00042',
        product_rank1: 'vay',
        last_list_date: '2026-07-19',
      },
    ]);

    await expectAsync(resultPromise).toBeResolvedTo([
      jasmine.objectContaining({ customer_id: 42, cif_code: 'CIF-00042' }),
    ]);
  });

  it('loads the dated call list with bearer authentication', async () => {
    const resultPromise = api.getCallList('2026-07-19');
    await Promise.resolve();

    const request = http.expectOne('https://api.startflow.test/api/nba/calllist?date=2026-07-19');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer nba-token');
    request.flush([{ customer_id: 42, name: 'Khách hàng Demo', cif_code: 'CIF-42' }]);

    await expectAsync(resultPromise).toBeResolvedTo([
      jasmine.objectContaining({ customer_id: 42, cif_code: 'CIF-42' }),
    ]);
  });

  it('loads customer, assessment, notes and audit from their approved endpoints', async () => {
    const customerPromise = api.getCustomer(42);
    await Promise.resolve();
    http.expectOne('https://api.startflow.test/api/nba/customer/42').flush({
      customer_id: 42,
      full_name: 'Khách hàng Demo',
      cif_code: 'CIF-42',
      recommendation: null,
      versions: [],
      staleness: { flag: false, fields: [] },
    });
    await expectAsync(customerPromise).toBeResolvedTo(
      jasmine.objectContaining({ customer_id: 42 }),
    );

    const assessmentPromise = api.getAssessment(42, '2026-07-19');
    await Promise.resolve();
    http
      .expectOne('https://api.startflow.test/api/nba/customer/42/assessment?as_of=2026-07-19')
      .flush({ customer_id: 42, packages: [] });
    await expectAsync(assessmentPromise).toBeResolvedTo(
      jasmine.objectContaining({ customer_id: 42 }),
    );

    const notesPromise = api.getNotes(42);
    await Promise.resolve();
    http.expectOne('https://api.startflow.test/api/nba/notes/42').flush([]);
    await expectAsync(notesPromise).toBeResolvedTo([]);

    const auditPromise = api.getRecommendationAudit('123');
    await Promise.resolve();
    http
      .expectOne('https://api.startflow.test/api/nba/audit/recommendation/123')
      .flush({ id: '123' });
    await expectAsync(auditPromise).toBeResolvedTo(jasmine.objectContaining({ id: '123' }));
  });

  it('submits feedback without changing the backend payload contract', async () => {
    const body = {
      rec_id: '123',
      product: 'vay' as const,
      status: 'rejected' as const,
      reject_reason: 'Khách chưa có nhu cầu',
      note: 'Gọi lại sau 90 ngày',
    };
    const resultPromise = api.submitFeedback(body);
    await Promise.resolve();

    const request = http.expectOne('https://api.startflow.test/api/nba/feedback');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ ok: true, suppressed: true });

    await expectAsync(resultPromise).toBeResolvedTo({ ok: true, suppressed: true });
  });

  it('saves a call note with snake_case fields', async () => {
    const resultPromise = api.saveNote(42, 'Khách hẹn gọi lại vào thứ Hai');
    await Promise.resolve();

    const request = http.expectOne('https://api.startflow.test/api/nba/notes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      customer_id: 42,
      note_text: 'Khách hẹn gọi lại vào thứ Hai',
    });
    request.flush({ ok: true, noteId: 7 });

    await expectAsync(resultPromise).toBeResolvedTo({ ok: true, noteId: 7 });
  });
});
