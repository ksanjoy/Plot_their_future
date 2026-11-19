import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { AuthUser } from '../common/auth.js';
import { InvitationModel, WeddingMemberModel, WeddingModel, type InvitationDoc, type WeddingDoc, type WeddingMemberDoc } from '../models/schemas.js';

export type WeddingRole = 'HOST' | 'CO_HOST' | 'LEAD' | 'VENUE' | 'GUEST' | 'PLATFORM';

export const ADMIN_ROLES: WeddingRole[] = ['HOST', 'CO_HOST'];
export const STAFF_ROLES: WeddingRole[] = ['HOST', 'CO_HOST', 'LEAD', 'VENUE'];

export interface WeddingAccess {
  user: AuthUser;
  wedding: WeddingDoc;
  role: WeddingRole;
  member: WeddingMemberDoc | null;
  invitation: InvitationDoc | null;
}

/**
 * Tenant isolation for every wedding-scoped route. Access is always re-derived
 * from the database (roster + membership), never trusted from token claims, so
 * removing a guest from the roster revokes access immediately.
 */
@Injectable()
export class WeddingAccessService {
  async resolve(user: AuthUser | undefined, slug: string): Promise<WeddingAccess> {
    if (!user) throw new UnauthorizedException('Authentication required');
    const wedding = await WeddingModel.findOne({ slug });
    if (!wedding) throw new NotFoundException('Wedding not found');

    const [member, invitation] = await Promise.all([
      WeddingMemberModel.findOne({ weddingId: wedding._id, userId: user.id }),
      InvitationModel.findOne({ weddingId: wedding._id, phone: user.phone }),
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

    const status = wedding.approvalStatus ?? 'APPROVED';
    const visibility = wedding.linkVisibility ?? 'PUBLIC';
    if (role === 'GUEST' && (status !== 'APPROVED' || visibility === 'PAUSED')) {
      throw new ForbiddenException({
        code: visibility === 'PAUSED' ? 'LINK_PAUSED' : 'NOT_PUBLISHED',
        message: visibility === 'PAUSED' ? 'The couple has paused this invitation link.' : 'This celebration is not published yet.',
      });
    }

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
