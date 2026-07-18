import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  createRunResponseSchema,
  type ApprovalRequest,
  type CaseInput,
} from '@startflow/contracts';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import type {
  CaseDetail,
  CaseSummary,
  ComparisonResult,
  KnowledgeDocument,
  RunDetail,
} from './models';
import {
  normalizeCaseDetail,
  normalizeCaseSummary,
  normalizeCollection,
  normalizeComparison,
  normalizeKnowledgeDocument,
  normalizeRunDetail,
  unwrapPayload,
} from './normalizers';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class StartFlowApiService {
  private readonly http = inject<HttpClient>(HttpClient);
  private readonly environment = inject(APP_ENVIRONMENT);
  private readonly authState = inject<AuthStateService>(AuthStateService);

  async listCases(): Promise<CaseSummary[]> {
    const payload = await this.#request<unknown>('GET', '/cases');
    return normalizeCollection(payload).map(normalizeCaseSummary);
  }

  async createCase(input: CaseInput): Promise<CaseDetail> {
    return normalizeCaseDetail(unwrapPayload(await this.#request('POST', '/cases', input)));
  }

  async getCase(caseId: string): Promise<CaseDetail> {
    return normalizeCaseDetail(
      unwrapPayload(await this.#request('GET', `/cases/${encodeURIComponent(caseId)}`)),
    );
  }

  async createRun(caseId: string): Promise<{ runId: string; status: string }> {
    const parsed = createRunResponseSchema.safeParse(
      unwrapPayload(await this.#request('POST', `/cases/${encodeURIComponent(caseId)}/runs`)),
    );
    if (!parsed.success) {
      throw new ApiError('Phản hồi khởi tạo lượt đánh giá không hợp lệ.', 502, 'INVALID_RESPONSE');
    }
    return parsed.data;
  }

  async getRun(runId: string): Promise<RunDetail> {
    return normalizeRunDetail(
      unwrapPayload(await this.#request('GET', `/runs/${encodeURIComponent(runId)}`)),
    );
  }

  async submitApproval(runId: string, input: ApprovalRequest): Promise<RunDetail> {
    await this.#request('POST', `/runs/${encodeURIComponent(runId)}/approvals`, input);
    return this.getRun(runId);
  }

  async createComparison(caseId: string): Promise<ComparisonResult> {
    const payload = unwrapPayload(
      await this.#request('POST', `/cases/${encodeURIComponent(caseId)}/comparisons`),
    );
    return normalizeComparison(payload, caseId);
  }

  async listKnowledge(): Promise<KnowledgeDocument[]> {
    return normalizeCollection(await this.#request('GET', '/knowledge')).flatMap((item) => {
      const document = normalizeKnowledgeDocument(item);
      return document ? [document] : [];
    });
  }

  async ingestKnowledge(input: {
    title: string;
    domain: string;
    content: string;
    demoData: true;
  }): Promise<KnowledgeDocument> {
    const document = normalizeKnowledgeDocument(
      unwrapPayload(await this.#request('POST', '/knowledge', input)),
    );
    if (!document) throw new ApiError('Phản hồi tài liệu không hợp lệ.', 502, 'INVALID_RESPONSE');
    return document;
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.authState.getAccessToken();
    const headers = new HttpHeaders({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    });
    try {
      return await firstValueFrom(
        this.http.request<T>(method, `${this.environment.apiUrl}${path}`, {
          body,
          headers,
        }),
      );
    } catch (error) {
      throw mapApiError(error);
    }
  }
}

function mapApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    const payload = isErrorPayload(error.error) ? error.error : {};
    return new ApiError(
      typeof payload['message'] === 'string'
        ? payload['message']
        : `Yêu cầu thất bại (${error.status || 0})`,
      error.status || 0,
      typeof payload['code'] === 'string' ? payload['code'] : undefined,
    );
  }
  return new ApiError(error instanceof Error ? error.message : 'Yêu cầu thất bại.', 0);
}

function isErrorPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
