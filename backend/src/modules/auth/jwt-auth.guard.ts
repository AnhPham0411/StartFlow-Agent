import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import type { RequestContext } from '../../common/types/request-context';
import type { AppEnvironment, AuthMode } from '../../config/env.validation';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from '../../database/prisma.service';

interface RealmAccess {
  roles?: unknown;
}

// Dev-login: mọi role hợp lệ để xem đủ luồng; có thể thu hẹp bằng header x-dev-roles.
const DEV_ROLES = ['analyst', 'approver', 'admin', 'sale', 'manager'];
const DEV_SUBJECT = 'demo-reviewer';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly authMode: AuthMode;
  private readonly audience: string;
  private readonly issuer: string;
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    config: ConfigService<AppEnvironment, true>,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    this.authMode = config.get('AUTH_MODE', { infer: true });
    this.audience = config.get('KEYCLOAK_AUDIENCE', { infer: true });
    this.issuer = config.get('KEYCLOAK_ISSUER', { infer: true });
    // Chỉ dựng JWKS khi thực sự dùng Keycloak — chế độ mock không có issuer.
    if (this.authMode === 'keycloak') {
      this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/protocol/openid-connect/certs`));
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();

    // Dev-login: bỏ qua Keycloak, gán user demo. KHÔNG bao giờ bật ở production (chặn ở env.validation).
    if (this.authMode === 'mock') {
      const devRoles = request.header('x-dev-roles');
      const devBranch = request.header('x-dev-branch');
      const devUserId = request.header('x-dev-user-id');
      request.user = await this.toDevUser(devRoles, devBranch, devUserId);
      return true;
    }

    const token = this.extractBearerToken(request.header('authorization'));
    const jwks = this.jwks;
    if (!token || !jwks) {
      throw new UnauthorizedException('Bearer access token is required');
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['RS256'],
        audience: this.audience,
        issuer: this.issuer,
      });
      request.user = await this.toUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }

  /**
   * Dựng user demo. Nguồn sự thật là bảng `users` tra theo id — role và branch lấy từ DB,
   * header chỉ dùng làm dự phòng khi id không tồn tại.
   *
   * Lưu ý: frontend KHÔNG gửi `x-dev-branch` nữa vì header HTTP chỉ nhận ISO-8859-1, mà tên
   * chi nhánh thật ("Hà Nội - Đống Đa") chứa ký tự ngoài bảng mã đó. Tham số giữ lại cho
   * tương thích nếu ai đó gọi bằng curl.
   *
   * Dự phòng để rỗng chứ không đặt tên giả: branch rỗng khiến manager không khớp user nào
   * và bị chặn — sai theo hướng an toàn, hơn là mở nhầm dữ liệu chi nhánh khác.
   */
  private async toDevUser(rolesHeader: string | undefined, branchHeader: string | undefined, idHeader: string | undefined) {
    const requested = (rolesHeader ?? '')
      .split(',')
      .map((role) => role.trim())
      .filter((role) => DEV_ROLES.includes(role));
    const roles = requested.length > 0 ? requested : DEV_ROLES;
    const branch = branchHeader ?? '';
    let userId = idHeader ? Number(idHeader) : 1;

    try {
      const dbUsers = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, branch, role::text FROM users WHERE id = $1 LIMIT 1`,
        userId
      );
      if (dbUsers && dbUsers.length > 0) {
        const u = dbUsers[0];
        // Cast SQL BIGINT properly
        return {
          id: Number(u.id),
          roles: [u.role],
          sub: DEV_SUBJECT,
          username: DEV_SUBJECT,
          branch: u.branch || branch,
        };
      }
    } catch {}

    return { id: userId, roles, sub: DEV_SUBJECT, username: DEV_SUBJECT, branch };
  }

  private extractBearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, token, extra] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token && !extra ? token : undefined;
  }

  private async toUser(payload: JWTPayload) {
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Token subject is missing');
    }
    const realmAccess = payload.realm_access as RealmAccess | undefined;
    const roles = Array.isArray(realmAccess?.roles)
      ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const username =
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined;

    let id: number | undefined;
    let branch: string | undefined;

    if (username) {
      try {
        const dbUsers = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id, branch FROM users WHERE username = $1 LIMIT 1`,
          username
        );
        if (dbUsers && dbUsers.length > 0) {
          id = Number(dbUsers[0].id);
          branch = dbUsers[0].branch;
        }
      } catch {}
    }

    return { roles, sub: payload.sub, ...(username ? { username } : {}), id, branch };
  }
}
