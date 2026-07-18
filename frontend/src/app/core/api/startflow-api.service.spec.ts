import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CaseInput } from '@startflow/contracts';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { ApiError, StartFlowApiService } from './startflow-api.service';

describe('StartFlowApiService', () => {
  let api: StartFlowApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        StartFlowApiService,
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
          useValue: { getAccessToken: () => Promise.resolve('ephemeral-token') },
        },
      ],
    });
    api = TestBed.inject(StartFlowApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends a bearer token and normalizes collection envelopes', async () => {
    const resultPromise = api.listCases();
    const request = await expectRequest('GET', '/cases');
    expect(request.request.headers.get('Authorization')).toBe('Bearer ephemeral-token');
    request.flush({ data: { items: [{ id: 'case-1', companyName: 'Demo' }] } });

    await expectAsync(resultPromise).toBeResolvedTo([
      jasmine.objectContaining({ id: 'case-1', companyName: 'Demo' }),
    ]);
  });

  it('keeps the case creation endpoint and payload unchanged', async () => {
    const input: CaseInput = {
      companyName: 'Công ty Demo',
      registrationNumber: 'DEMO-001',
      requestedAmount: 2_000_000_000,
      purpose: 'Bổ sung vốn lưu động cho doanh nghiệp',
      financials: {
        revenue: 10,
        ebitda: 2,
        totalDebt: 3,
        equity: 4,
        currentAssets: 5,
        currentLiabilities: 2,
      },
      submittedDocuments: [],
      demoData: true,
    };

    const resultPromise = api.createCase(input);
    const request = await expectRequest('POST', '/cases');
    expect(request.request.body).toEqual(input);
    request.flush({ data: { id: 'case-1', ...input } });

    await expectAsync(resultPromise).toBeResolvedTo(jasmine.objectContaining({ id: 'case-1' }));
  });

  it('rejects an invalid create-run response at the API boundary', async () => {
    const resultPromise = api.createRun('case-1');
    const request = await expectRequest('POST', '/cases/case-1/runs');
    request.flush({ data: { runId: 'not-a-uuid', status: 'RUNNING' } });

    await expectAsync(resultPromise).toBeRejectedWith(
      jasmine.objectContaining({ status: 502, code: 'INVALID_RESPONSE' }),
    );
  });

  it('preserves approval expectedVersion and reloads the run snapshot', async () => {
    const resultPromise = api.submitApproval('run/with spaces', {
      decision: 'APPROVE',
      reason: 'Đã kiểm tra đầy đủ',
      expectedVersion: 7,
    });
    const approvalRequest = await expectRequest('POST', '/runs/run%2Fwith%20spaces/approvals');
    expect(approvalRequest.request.body).toEqual({
      decision: 'APPROVE',
      reason: 'Đã kiểm tra đầy đủ',
      expectedVersion: 7,
    });
    approvalRequest.flush({ data: { version: 8 } });

    const reloadRequest = await expectRequest('GET', '/runs/run%2Fwith%20spaces');
    reloadRequest.flush({ data: { id: 'run/with spaces', caseId: 'case-1', status: 'COMPLETED' } });
    await expectAsync(resultPromise).toBeResolvedTo(
      jasmine.objectContaining({ id: 'run/with spaces', version: 0 }),
    );
  });

  it('maps backend errors to ApiError without losing status or code', async () => {
    const resultPromise = api.getCase('missing');
    const request = await expectRequest('GET', '/cases/missing');
    request.flush(
      { message: 'Không tìm thấy hồ sơ', code: 'CASE_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );

    try {
      await resultPromise;
      fail('Expected request to reject');
    } catch (error) {
      expect(error).toEqual(jasmine.any(ApiError));
      expect(error as ApiError).toEqual(
        jasmine.objectContaining({ status: 404, code: 'CASE_NOT_FOUND' }),
      );
    }
  });

  async function expectRequest(method: string, path: string) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne(`https://api.startflow.test/api${path}`);
    expect(request.request.method).toBe(method);
    return request;
  }
});
