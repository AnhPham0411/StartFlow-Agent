import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { ApiError } from './startflow-api.service';
import type {
  NbaAssessmentResult,
  NbaCallListEntry,
  NbaCallNote,
  NbaCustomerDetail,
  NbaFeedbackInput,
  NbaRecommendationAudit,
} from './nba.models';

@Injectable({ providedIn: 'root' })
export class NbaApiService {
  private readonly http = inject(HttpClient);
  private readonly environment = inject(APP_ENVIRONMENT);
  private readonly authState = inject(AuthStateService);

  getCallList(date: string): Promise<NbaCallListEntry[]> {
    return this.#request('GET', '/nba/calllist', undefined, new HttpParams().set('date', date));
  }

  getCustomer(customerId: number): Promise<NbaCustomerDetail> {
    return this.#request('GET', `/nba/customer/${encodeURIComponent(customerId)}`);
  }

  getAssessment(customerId: number, asOf?: string): Promise<NbaAssessmentResult> {
    const params = asOf ? new HttpParams().set('as_of', asOf) : undefined;
    return this.#request(
      'GET',
      `/nba/customer/${encodeURIComponent(customerId)}/assessment`,
      undefined,
      params,
    );
  }

  getNotes(customerId: number): Promise<NbaCallNote[]> {
    return this.#request('GET', `/nba/notes/${encodeURIComponent(customerId)}`);
  }

  getRecommendationAudit(recommendationId: string): Promise<NbaRecommendationAudit> {
    return this.#request(
      'GET',
      `/nba/audit/recommendation/${encodeURIComponent(recommendationId)}`,
    );
  }

  submitFeedback(input: NbaFeedbackInput): Promise<{ ok: boolean; suppressed: boolean }> {
    return this.#request('POST', '/nba/feedback', input);
  }

  saveNote(customerId: number, noteText: string): Promise<{ ok: boolean; noteId: number }> {
    return this.#request('POST', '/nba/notes', {
      customer_id: customerId,
      note_text: noteText,
    });
  }

  async #request<T>(method: string, path: string, body?: unknown, params?: HttpParams): Promise<T> {
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
          params,
        }),
      );
    } catch (error) {
      throw mapNbaApiError(error);
    }
  }
}

function mapNbaApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    const payload = isErrorPayload(error.error) ? error.error : {};
    return new ApiError(
      typeof payload['message'] === 'string'
        ? payload['message']
        : `Yêu cầu NBA thất bại (${error.status || 0})`,
      error.status || 0,
      typeof payload['code'] === 'string' ? payload['code'] : undefined,
    );
  }
  return new ApiError(error instanceof Error ? error.message : 'Yêu cầu NBA thất bại.', 0);
}

function isErrorPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
