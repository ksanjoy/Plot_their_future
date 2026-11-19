import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import type { WeddingAccess } from '../access/wedding-access.service.js';
import type { AuthUser } from '../common/auth.js';
import { hmacSha256 } from '../common/utils/crypto.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { idString, oid, withTransaction } from '../database/helpers.js';
import { LedgerEntryModel, SettlementModel, WeddingModel, type SettlementDoc, type WeddingDoc } from '../models/schemas.js';
import type { SettlementDestination, SettlementStatus } from '../models/types.js';

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
  constructor(@InjectEnv() private readonly env: Env) {}

  private sign(s: SettlementDoc, stage: string, userId: string, at: Date) {
    return hmacSha256(
      this.env.RECEIPT_SIGNING_SECRET,
      [s.id, idString(s.weddingId), s.amountPaise, s.destination, s.accountNumber, s.ifsc, stage, userId, at.toISOString()].join('|'),
    );
  }

  view(s: SettlementDoc, reveal = false) {
    return {
      id: s.id,
      weddingId: idString(s.weddingId),
      amountPaise: s.amountPaise,
      destination: s.destination,
      beneficiaryName: s.beneficiaryName,
      accountNumber: reveal ? s.accountNumber : maskAccount(s.accountNumber),
      ifsc: s.ifsc,
      status: s.status,
      requestedById: idString(s.requestedById),
      hostApprovedById: s.hostApprovedById ? idString(s.hostApprovedById) : null,
      hostApprovedAt: s.hostApprovedAt,
      hostSignature: s.hostSignature,
      complianceApprovedById: s.complianceApprovedById ? idString(s.complianceApprovedById) : null,
      complianceApprovedAt: s.complianceApprovedAt,
      complianceSignature: s.complianceSignature,
      rejectedReason: s.rejectedReason,
      bankReference: s.bankReference,
      disbursedAt: s.disbursedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  async balances(weddingId: string, session?: ClientSession) {
    const match = { weddingId: oid(weddingId) };
    const [grouped, reserved] = await Promise.all([
      LedgerEntryModel.aggregate<{ _id: string; amountPaise: number }>([
        { $match: match },
        { $group: { _id: '$type', amountPaise: { $sum: '$amountPaise' } } },
      ]).session(session ?? null),
      SettlementModel.aggregate<{ amountPaise: number }>([
        { $match: { ...match, status: { $in: OPEN_STATUSES } } },
        { $group: { _id: null, amountPaise: { $sum: '$amountPaise' } } },
      ]).session(session ?? null),
    ]);
    const sum = (t: string) => grouped.find((g) => g._id === t)?.amountPaise ?? 0;
    const credits = sum('CREDIT');
    const debits = sum('DEBIT');
    const refunds = sum('REFUND');
    const balancePaise = credits - debits - refunds;
    const reservedPaise = reserved[0]?.amountPaise ?? 0;
    return { creditsPaise: credits, debitsPaise: debits, refundsPaise: refunds, balancePaise, reservedPaise, availablePaise: balancePaise - reservedPaise };
  }

  async ledger(access: WeddingAccess) {
    const w = access.wedding;
    const [entries, balances, settlements] = await Promise.all([
      LedgerEntryModel.find({ weddingId: w._id })
        .sort({ createdAt: -1 })
        .limit(500)
        .populate<{ contribution: { donorName: string; units: number; receiptNumber: string | null } | null }>('contribution', 'donorName units receiptNumber'),
      this.balances(w.id),
      SettlementModel.find({ weddingId: w._id }).sort({ createdAt: -1 }),
    ]);
    return {
      escrow: { bankName: w.escrowBankName, accountNumber: w.escrowAccountNumber, ifsc: w.escrowIfsc, reraRegId: w.reraRegId },
      balances,
      entries: entries.map((entry) => {
        const contribution = entry.get('contribution') as { donorName: string; units: number; receiptNumber: string | null } | null;
        return {
          id: entry.id,
          weddingId: idString(entry.weddingId),
          contributionId: entry.contributionId ? idString(entry.contributionId) : null,
          settlementId: entry.settlementId ? idString(entry.settlementId) : null,
          type: entry.type,
          amountPaise: entry.amountPaise,
          reference: entry.reference,
          createdAt: entry.createdAt,
          contribution: contribution
            ? { donorName: contribution.donorName, units: contribution.units, receiptNumber: contribution.receiptNumber }
            : null,
        };
      }),
      settlements: settlements.map((s) => this.view(s)),
    };
  }

  async request(access: WeddingAccess, input: SettlementInput) {
    const kyc = access.wedding.kycStatus ?? 'NOT_REQUIRED';
    if (kyc === 'REQUIRED' || kyc === 'SUBMITTED' || kyc === 'REJECTED') {
      throw new ConflictException({
        code: 'KYC_REQUIRED',
        message: 'Payouts need verified identity and bank details for the receiving party',
      });
    }
    return withTransaction(async (session) => {
      // Touch the wedding so two concurrent requests conflict and the loser retries after the first commits.
      await WeddingModel.updateOne({ _id: access.wedding._id }, { $currentDate: { updatedAt: true } }, { session });
      const { availablePaise } = await this.balances(access.wedding.id, session);
      if (input.amountPaise > availablePaise) {
        throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Amount exceeds the available escrow balance' });
      }
      const [s] = await SettlementModel.create(
        [{ ...input, ifsc: input.ifsc.toUpperCase(), weddingId: access.wedding._id, requestedById: access.user.id }],
        { session },
      );
      if (!s) throw new Error('Failed to create settlement');
      return this.view(s);
    });
  }

  private async find(id: string, weddingId?: string) {
    const s = await SettlementModel.findOne({ _id: id, ...(weddingId ? { weddingId } : {}) });
    if (!s) throw new NotFoundException('Settlement not found');
    return s;
  }

  async hostApprove(access: WeddingAccess, id: string) {
    const s = await this.find(id, access.wedding.id);
    if (s.status !== 'REQUESTED') throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
    const at = new Date();
    const updated = await SettlementModel.findOneAndUpdate(
      { _id: id, status: 'REQUESTED' },
      { $set: { status: 'HOST_APPROVED', hostApprovedById: access.user.id, hostApprovedAt: at, hostSignature: this.sign(s, 'HOST', access.user.id, at) } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Record not found');
    return this.view(updated);
  }

  async listForCompliance(user: AuthUser, status?: SettlementStatus) {
    this.requirePlatform(user);
    const rows = await SettlementModel.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate<{ wedding: Pick<WeddingDoc, 'slug' | 'brideName' | 'groomName' | 'escrowBankName' | 'escrowAccountNumber'> }>('wedding', 'slug brideName groomName escrowBankName escrowAccountNumber');
    return rows.map((s) => {
      const wedding = s.get('wedding') as WeddingDoc;
      return {
        ...this.view(s, true),
        wedding: {
          slug: wedding.slug,
          brideName: wedding.brideName,
          groomName: wedding.groomName,
          escrowBankName: wedding.escrowBankName,
          escrowAccountNumber: wedding.escrowAccountNumber,
        },
      };
    });
  }

  private requirePlatform(user: AuthUser) {
    if (!user.isPlatformAdmin) throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Platform compliance only' });
  }

  async complianceApprove(user: AuthUser, id: string) {
    this.requirePlatform(user);
    const s = await this.find(id);
    if (s.status !== 'HOST_APPROVED') throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
    if (idString(s.hostApprovedById) === user.id || idString(s.requestedById) === user.id) {
      throw new ForbiddenException({ code: 'DUAL_CONTROL', message: 'A different person must give compliance approval' });
    }
    const at = new Date();
    const updated = await SettlementModel.findOneAndUpdate(
      { _id: id, status: 'HOST_APPROVED' },
      {
        $set: {
          status: 'APPROVED',
          complianceApprovedById: user.id,
          complianceApprovedAt: at,
          complianceSignature: this.sign(s, 'COMPLIANCE', user.id, at),
        },
      },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Record not found');
    return this.view(updated, true);
  }

  async disburse(user: AuthUser, id: string, bankReference: string) {
    this.requirePlatform(user);
    return withTransaction(async (session) => {
      const s = await SettlementModel.findById(id).session(session);
      if (!s) throw new NotFoundException('Settlement not found');
      if (s.status !== 'APPROVED') throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
      const updated = await SettlementModel.findOneAndUpdate(
        { _id: id, status: 'APPROVED' },
        { $set: { status: 'DISBURSED', bankReference, disbursedAt: new Date() } },
        { new: true, session },
      );
      if (!updated) throw new NotFoundException('Record not found');
      await LedgerEntryModel.create(
        [{ weddingId: s.weddingId, settlementId: s._id, type: 'DEBIT', amountPaise: s.amountPaise, reference: `SETTLEMENT ${bankReference}` }],
        { session },
      );
      return this.view(updated, true);
    });
  }

  async reject(user: AuthUser, id: string, reason: string, access?: WeddingAccess) {
    if (!access) this.requirePlatform(user);
    const s = await this.find(id, access?.wedding.id);
    if (!OPEN_STATUSES.includes(s.status)) throw new ConflictException({ code: 'INVALID_STATE', message: `Settlement is ${s.status}` });
    const updated = await SettlementModel.findOneAndUpdate(
      { _id: id, status: s.status },
      { $set: { status: 'REJECTED', rejectedReason: reason } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Record not found');
    return this.view(updated, !access);
  }
}
