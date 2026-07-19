import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../config/env.validation';
import type { ApplicationRole } from '../auth/roles.decorator';

interface KeycloakTokenResponse {
  access_token?: unknown;
}

interface KeycloakRole {
  id: string;
  name: string;
}

@Injectable()
export class KeycloakAdminClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly issuer: string;
  private readonly initialPassword?: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.clientId = config.get('KEYCLOAK_ADMIN_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('KEYCLOAK_ADMIN_CLIENT_SECRET', { infer: true });
    this.issuer = config.get('KEYCLOAK_ISSUER', { infer: true });
    this.initialPassword = config.get('STARTFLOW_DEMO_INITIAL_PASSWORD', { infer: true });
  }

  async provisionAccount(
    username: string,
    fullName: string,
    role: ApplicationRole,
  ): Promise<string> {
    if (!this.initialPassword) {
      throw new ServiceUnavailableException('Demo initial password is not configured');
    }
    const response = await this.request('', {
      body: JSON.stringify({ enabled: true, firstName: fullName, username }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    let id = response.headers.get('location')?.split('/').pop();
    if (!id) id = await this.findUserId(username);
    if (!id) throw new ServiceUnavailableException('Keycloak did not return the created user id');
    try {
      await this.assignRole(id, role);
      await this.resetPassword(id);
      return id;
    } catch (error) {
      await this.deleteAccount(id).catch(() => undefined);
      throw error;
    }
  }

  async updateAccount(
    id: string,
    update: { enabled?: boolean; fullName?: string; role?: ApplicationRole },
  ): Promise<void> {
    if (update.enabled !== undefined || update.fullName !== undefined) {
      await this.request(`/${encodeURIComponent(id)}`, {
        body: JSON.stringify({
          ...(update.enabled === undefined ? {} : { enabled: update.enabled }),
          ...(update.fullName === undefined ? {} : { firstName: update.fullName }),
        }),
        headers: { 'content-type': 'application/json' },
        method: 'PUT',
      });
    }
    if (update.role) await this.assignRole(id, update.role);
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.updateAccount(id, { enabled });
  }

  async resetPassword(id: string): Promise<void> {
    if (!this.initialPassword) {
      throw new ServiceUnavailableException('Demo initial password is not configured');
    }
    await this.request(`/${encodeURIComponent(id)}/reset-password`, {
      body: JSON.stringify({ temporary: true, type: 'password', value: this.initialPassword }),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    });
    await this.request(`/${encodeURIComponent(id)}`, {
      body: JSON.stringify({ requiredActions: ['UPDATE_PASSWORD'] }),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  private async assignRole(id: string, role: ApplicationRole): Promise<void> {
    const roles = await this.getRoles();
    const selected = roles.find((item) => item.name === role);
    if (!selected) throw new ServiceUnavailableException(`Keycloak role ${role} is missing`);
    const applicationRoles = roles.filter((item) =>
      ['employee', 'manager', 'admin'].includes(item.name),
    );
    if (applicationRoles.length) {
      await this.request(`/${encodeURIComponent(id)}/role-mappings/realm`, {
        body: JSON.stringify(applicationRoles),
        headers: { 'content-type': 'application/json' },
        method: 'DELETE',
      });
    }
    await this.request(`/${encodeURIComponent(id)}/role-mappings/realm`, {
      body: JSON.stringify([selected]),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }

  private async getRoles(): Promise<KeycloakRole[]> {
    const response = await this.adminRequest('/roles');
    return (await response.json()) as KeycloakRole[];
  }

  private async findUserId(username: string): Promise<string | undefined> {
    const response = await this.adminRequest(
      `/users?exact=true&username=${encodeURIComponent(username)}`,
    );
    const rows = (await response.json()) as Array<{ id?: string }>;
    return rows[0]?.id;
  }

  private request(path: string, init?: RequestInit): Promise<Response> {
    return this.adminRequest(`/users${path}`, init);
  }

  private async adminRequest(path: string, init?: RequestInit): Promise<Response> {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException('Keycloak Admin API is not configured');
    }
    const tokenResponse = await fetch(`${this.issuer}/protocol/openid-connect/token`, {
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    });
    if (!tokenResponse.ok) throw new ServiceUnavailableException('Keycloak admin token failed');
    const token = (await tokenResponse.json()) as KeycloakTokenResponse;
    if (typeof token.access_token !== 'string') {
      throw new ServiceUnavailableException('Keycloak admin token is missing');
    }
    const response = await fetch(`${this.adminRealmUrl()}${path}`, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Keycloak Admin API request failed');
    return response;
  }

  private adminRealmUrl(): string {
    const marker = '/realms/';
    const index = this.issuer.indexOf(marker);
    if (index < 0) throw new ServiceUnavailableException('Keycloak issuer is invalid');
    const origin = this.issuer.slice(0, index);
    const realm = this.issuer.slice(index + marker.length);
    return `${origin}/admin/realms/${encodeURIComponent(realm)}`;
  }
}
