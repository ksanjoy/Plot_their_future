import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Invitation, Wedding, WeddingMember } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/auth.js';

export type WeddingRole = 'HOST' | 'CO_HOST' | 'LEAD' | 'VENUE' | 'GUEST' | 'PLATFORM';

export const ADMIN_ROLES: WeddingRole[] = ['HOST', 'CO_HOST'];
export const STAFF_ROLES: WeddingRole[] = ['HOST', 'CO_HOST', 'LEAD', 'VENUE'];

export interface WeddingAccess {
  user: AuthUser;
  wedding: Wedding;
  role: WeddingRole;
  member: WeddingMember | null;
  invitation: Invitation | null;
}

/**
 * Tenant isolation for every wedding-scoped route. Access is always re-derived
 * from the database (roster + membership), never trusted from token claims, so
 * removing a guest from the roster revokes access immediately.
 */
@Injectable()
export class WeddingAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: AuthUser | undefined, slug: string): Promise<WeddingAccess> {
    if (!user) throw new UnauthorizedException('Authentication required');
    const wedding = await this.prisma.wedding.findUnique({ where: { slug } });
    if (!wedding) throw new NotFoundException('Wedding not found');

    const [member, invitation] = await Promise.all([
      this.prisma.weddingMember.findUnique({ where: { weddingId_userId: { weddingId: wedding.id, userId: user.id } } }),
      this.prisma.invitation.findUnique({ where: { weddingId_phone: { weddingId: wedding.id, phone: user.phone } } }),
    ]);

    let role: WeddingRole;
    if (member) role = member.role;
    else if (invitation) role = 'GUEST';
    else if (user.isPlatformAdmin) role = 'PLATFORM';
    else
      throw new ForbiddenException({
        code: 'NOT_INVITED',
        message: 'This is a private celebration. Your number is not on the guest list.',
      });

    return { user, wedding, role, member, invitation };
  }

  async require(user: AuthUser | undefined, slug: string, roles: WeddingRole[]): Promise<WeddingAccess> {
    const access = await this.resolve(user, slug);
    if (!roles.includes(access.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'You are not authorised for this action' });
    }
    return access;
  }

  isAdmin(access: WeddingAccess) {
    return ADMIN_ROLES.includes(access.role);
  }

  isStaff(access: WeddingAccess) {
    return STAFF_ROLES.includes(access.role) || access.role === 'PLATFORM';
  }
}
