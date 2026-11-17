import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import type { AuthUser } from '../common/auth.js';
import { hmacSha256 } from '../common/utils/crypto.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import type { Settlement, SettlementDestination, SettlementStatus } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

export interface SettlementInput {
  amountPaise: number;
  destination: SettlementDestination;
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
}

const OPEN_STATUSES: SettlementStatus[] = ['REQUESTED', 'HOST_APPROVED', 'APPROVED'];

const maskAccount = (acc: string) => (acc.length <= 4 ? acc : `${'•'.repeat(Math.min(acc.length - 4, 8))}${acc.slice(-4)}`);

/**
 * Escrow ledger and the dual-control settlement workflow:
 * REQUESTED -> HOST_APPROVED (a host signs) -> APPROVED (platform compliance
 * signs, must be a different person) -> DISBURSED (bank reference recorded,
 * DEBIT posted). Any open request can be REJECTED.
 */
@Injectable()
export class FinanceService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  private sign(s: Settlement, stage: string, userId: string, at: Date) {
    return hmacSha256(
      this.env.RECEIPT_SIGNING_SECRET,
      [s.id, s.weddingId, s.amountPaise, s.destination, s.accountNumber, s.ifsc, stage, userId, at.toISOString()].join('|'),
    );
  }

  view(s: Settlement, reveal = false) {
    return { ...s, accountNumber: reveal ? s.accountNumber : maskAccount(s.accountNumber) };
  }

  async balances(weddingId: string, tx: Tx = this.prisma) {
    const [grouped, reserved] = await Promise.all([
      tx.ledgerEntry.groupBy({ by: ['type'], where: { weddingId }, _sum: { amountPaise: true } }),
      tx.settlement.aggregate({ where: { weddingId, status: { in: OPEN_STATUSES } }, _sum: { amountPaise: true } }),
    ]);
    const sum = (t: string) => grouped.find((g) => g.type === t)?._sum.amountPaise ?? 0;
    const credits = sum('CREDIT');
    const debits = sum('DEBIT');
    const refunds = sum('REFUND');
    const balancePaise = credits - debits - refunds;
    const reservedPaise = reserved._sum.amountPaise ?? 0;
    return { creditsPaise: credits, debitsPaise: debits, refundsPaise: refunds, balancePaise, reservedPaise, availablePaise: balancePaise - reservedPaise };
  }

  async ledger(access: WeddingAccess) {
    const w = access.wedding;
    const [entries, balances, settlements] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { weddingId: w.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { contribution: { select: { donorName: true, units: true, receiptNumber: true } } },
      }),
      this.balances(w.id),
      this.prisma.settlement.findMany({ where: { weddingId: w.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      escrow: { bankName: w.escrowBankName, accountNumber: w.escrowAccountNumber, ifsc: w.escrowIfsc, reraRegId: w.reraRegId },
      balances,
      entries,
      settlements: settlements.map((s) => this.view(s)),
    };
  }

  async request(access: WeddingAccess, input: SettlementInput) {
    return this.prisma.$transaction(async (tx) => {
      // Serialise settlement requests per wedding so two concurrent requests cannot both pass the balance check.
      await tx.$queryRaw`SELECT id FROM "Wedding" WHERE id = ${access.wedding.id}::uuid FOR UPDATE`;
      const { availablePaise } = await this.balances(access.wedding.id, tx);
      if (input.amountPaise > availablePaise) {
        throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Amount exceeds the available escrow balance' });
      }
      const s = await tx.settlement.create({
        data: { ...input, ifsc: input.ifsc.toUpperCase(), weddingId: access.wedding.id, requestedById: access.user.id },
      });
      return this.view(s);
    });
  }

  private async find(id: string, weddingId?: string) {
    const s = await this.prisma.settlement.findFirst({ where: { id, ...(weddingId ? { weddingId } : {}) } });
    if (!s) throw new NotFoundException('Settlement not found');
    return s;
  }

  async hostApprove(access: WeddingAccess, id: string) {
    const s = await this.find(id, access.wedding.id);
    if (s.status !== 'REQUESTED') throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
    const at = new Date();
    const updated = await this.prisma.settlement.update({
      where: { id, status: 'REQUESTED' },
      data: { status: 'HOST_APPROVED', hostApprovedById: access.user.id, hostApprovedAt: at, hostSignature: this.sign(s, 'HOST', access.user.id, at) },
    });
    return this.view(updated);
  }

  async listForCompliance(user: AuthUser, status?: SettlementStatus) {
    this.requirePlatform(user);
    const rows = await this.prisma.settlement.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { wedding: { select: { slug: true, brideName: true, groomName: true, escrowBankName: true, escrowAccountNumber: true } } },
    });
    return rows.map(({ wedding, ...s }) => ({ ...this.view(s, true), wedding }));
  }

  private requirePlatform(user: AuthUser) {
    if (!user.isPlatformAdmin) throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Platform compliance only' });
  }

  async complianceApprove(user: AuthUser, id: string) {
    this.requirePlatform(user);
    const s = await this.find(id);
    if (s.status !== 'HOST_APPROVED') throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
    if (s.hostApprovedById === user.id || s.requestedById === user.id) {
      throw new ForbiddenException({ code: 'DUAL_CONTROL', message: 'A different person must give compliance approval' });
    }
    const at = new Date();
    const updated = await this.prisma.settlement.update({
      where: { id, status: 'HOST_APPROVED' },
      data: { status: 'APPROVED', complianceApprovedById: user.id, complianceApprovedAt: at, complianceSignature: this.sign(s, 'COMPLIANCE', user.id, at) },
    });
    return this.view(updated, true);
  }

  async disburse(user: AuthUser, id: string, bankReference: string) {
    this.requirePlatform(user);
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.settlement.findUnique({ where: { id } });
      if (!s) throw new NotFoundException('Settlement not found');
      if (s.status !== 'APPROVED') throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
      const updated = await tx.settlement.update({
        where: { id, status: 'APPROVED' },
        data: { status: 'DISBURSED', bankReference, disbursedAt: new Date() },
      });
      await tx.ledgerEntry.create({
        data: { weddingId: s.weddingId, settlementId: s.id, type: 'DEBIT', amountPaise: s.amountPaise, reference: `SETTLEMENT ${bankReference}` },
      });
      return this.view(updated, true);
    });
  }

  async reject(user: AuthUser, id: string, reason: string, access?: WeddingAccess) {
    if (!access) this.requirePlatform(user);
    const s = await this.find(id, access?.wedding.id);
    if (!OPEN_STATUSES.includes(s.status)) throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
    const updated = await this.prisma.settlement.update({ where: { id, status: s.status }, data: { status: 'REJECTED', rejectedReason: reason } });
    return this.view(updated, !access);
  }
}
