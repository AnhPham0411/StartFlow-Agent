import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  Account,
  Branch,
  CreateAccountInput,
  CreateBranchInput,
  CurrentIdentity,
  UpdateAccountInput,
  UpdateBranchInput,
  UserRole,
} from '@startflow/contracts';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../auth/auth-state.service';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { ApiError } from './startflow-api.service';

export interface BranchFilters {
  q?: string;
  active?: boolean;
}

export interface AccountFilters extends BranchFilters {
  role?: UserRole;
  branch_id?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  readonly #http = inject(HttpClient);
  readonly #environment = inject(APP_ENVIRONMENT);
  readonly #authState = inject(AuthStateService);

  getCurrentIdentity(): Promise<CurrentIdentity> {
    return this.#request('GET', '/auth/me');
  }

  listBranches(filters: BranchFilters = {}): Promise<Branch[]> {
    return this.#request('GET', '/admin/branches', undefined, branchParams(filters));
  }

  createBranch(input: CreateBranchInput): Promise<Branch> {
    return this.#request('POST', '/admin/branches', input);
  }

  updateBranch(id: number, input: UpdateBranchInput): Promise<Branch> {
    return this.#request('PUT', `/admin/branches/${encodeURIComponent(id)}`, input);
  }

  deactivateBranch(id: number): Promise<void> {
    return this.#request('POST', `/admin/branches/${encodeURIComponent(id)}/deactivate`);
  }

  listAccounts(filters: AccountFilters = {}): Promise<Account[]> {
    // Keep query ordering stable for diagnostics and request tests.
    return this.#request('GET', '/admin/accounts', undefined, accountParams(filters));
  }

  createAccount(input: CreateAccountInput): Promise<Account> {
    return this.#request('POST', '/admin/accounts', input);
  }

  updateAccount(id: number, input: UpdateAccountInput): Promise<Account> {
    return this.#request('PUT', `/admin/accounts/${encodeURIComponent(id)}`, input);
  }

  enableAccount(id: number): Promise<void> {
    return this.#request('POST', `/admin/accounts/${encodeURIComponent(id)}/enable`);
  }

  disableAccount(id: number): Promise<void> {
    return this.#request('POST', `/admin/accounts/${encodeURIComponent(id)}/disable`);
  }

  resetPassword(id: number): Promise<void> {
    return this.#request('POST', `/admin/accounts/${encodeURIComponent(id)}/reset-password`);
  }

  async #request<T>(method: string, path: string, body?: unknown, params?: HttpParams): Promise<T> {
    const token = await this.#authState.getAccessToken();
    const headers = new HttpHeaders({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    });

    try {
      return await firstValueFrom(
        this.#http.request<T>(method, `${this.#environment.apiUrl}${path}`, {
          body,
          headers,
          params,
        }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = isErrorPayload(error.error) ? error.error : {};
        throw new ApiError(
          typeof payload['message'] === 'string'
            ? payload['message']
            : `Yêu cầu quản trị thất bại (${error.status || 0})`,
          error.status || 0,
          typeof payload['code'] === 'string' ? payload['code'] : undefined,
        );
      }
      throw error;
    }
  }
}

function branchParams(filters: BranchFilters): HttpParams {
  let params = new HttpParams();
  if (filters.q?.trim()) params = params.set('q', filters.q.trim());
  if (filters.active !== undefined) params = params.set('active', String(filters.active));
  return params;
}

function accountParams(filters: AccountFilters): HttpParams {
  let params = new HttpParams();
  if (filters.q?.trim()) params = params.set('q', filters.q.trim());
  if (filters.role) params = params.set('role', filters.role);
  if (filters.branch_id !== undefined) params = params.set('branch_id', String(filters.branch_id));
  if (filters.active !== undefined) params = params.set('active', String(filters.active));
  return params;
}

function isErrorPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
