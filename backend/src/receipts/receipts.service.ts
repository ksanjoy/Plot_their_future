import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { LinkTokenService } from '../auth/link-token.service.js';
import { hmacSha256, safeEqual, sha256 } from '../common/utils/crypto.js';
import { initialsOf } from '../common/utils/format.js';
import { InjectEnv, type Env } from '../config/config.module.js';
import { ContributionModel, type ContributionDoc, type RoomZoneDoc, type WeddingDoc } from '../models/schemas.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { canonicalReceipt } from './canonical.js';

type FullContribution = ContributionDoc & { room: RoomZoneDoc; wedding: WeddingDoc };

const inr = (paise: number) => `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(paise / 100)}`;
const MAROON = '#8B1E2D';
const GOLD = '#C59B27';
const MUTED = '#64748B';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectEnv() private readonly env: Env,
    private readonly notifications: NotificationsService,
    private readonly links: LinkTokenService,
  ) {}

  canonical(c: FullContribution) {
    return canonicalReceipt(c);
  }

  private async load(id: string): Promise<FullContribution> {
    const c = await ContributionModel.findById(id).populate<{ room: RoomZoneDoc }>('room').populate<{ wedding: WeddingDoc }>('wedding');
    if (!c || c.status !== 'SUCCESS' || !c.receiptNumber) throw new NotFoundException('Receipt not found');
    const room = c.get('room') as RoomZoneDoc | undefined;
    const wedding = c.get('wedding') as WeddingDoc | undefined;
    if (!room || !wedding) throw new NotFoundException('Receipt not found');
    return Object.assign(c, { room, wedding });
  }

  /** Seals the receipt (hash + HMAC signature) and delivers it on WhatsApp. Idempotent. */
  async issue(contributionId: string) {
    let c = await this.load(contributionId);
    if (!c.receiptHash) {
      const hash = sha256(this.canonical(c));
      await ContributionModel.updateOne(
        { _id: c._id },
        { $set: { receiptHash: hash, receiptSignature: hmacSha256(this.env.RECEIPT_SIGNING_SECRET, hash) } },
      );
      c = await this.load(contributionId);
    }
    if (c.donorPhone) {
      const pdfUrl = `${this.env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/receipts/${c.id}/pdf?t=${this.links.sign(c.id, 'receipt', 30 * 86_400)}`;
      await this.notifications.sendReceipt({
        phone: c.donorPhone,
        donorName: c.donorName,
        units: c.units,
        roomName: c.room.name,
        amount: inr(c.amountPaise),
        receiptNumber: c.receiptNumber!,
        pdfUrl,
      });
    }
    return { receiptNumber: c.receiptNumber, hash: c.receiptHash };
  }

  async verify(receiptNumber: string) {
    const found = await ContributionModel.findOne({ receiptNumber }).populate<{ room: RoomZoneDoc }>('room').populate<{ wedding: WeddingDoc }>('wedding');
    if (!found || found.status !== 'SUCCESS' || !found.receiptHash || !found.receiptSignature) return { valid: false, receiptNumber };
    const room = found.get('room') as RoomZoneDoc;
    const wedding = found.get('wedding') as WeddingDoc;
    const c = Object.assign(found, { room, wedding });
    const hash = sha256(this.canonical(c));
    const valid = safeEqual(hash, found.receiptHash) && safeEqual(hmacSha256(this.env.RECEIPT_SIGNING_SECRET, hash), found.receiptSignature);
    return {
      valid,
      receiptNumber,
      hash: c.receiptHash,
      couple: `${wedding.brideName} & ${wedding.groomName}`,
      donorInitials: initialsOf(c.donorName),
      units: c.units,
      room: room.name,
      amountPaise: c.amountPaise,
      paidAt: c.paidAt,
      taxExempt: wedding.taxExemptionEnabled,
    };
  }

  async receiptData(id: string) {
    const c = await this.load(id);
    return {
      id: c.id,
      receiptNumber: c.receiptNumber,
      receiptHash: c.receiptHash,
      donorName: c.donorName,
      relationship: c.relationship,
      blessing: c.blessing,
      anonymous: c.anonymous,
      units: c.units,
      ratePaise: c.ratePaise,
      amountPaise: c.amountPaise,
      room: { key: c.room.key, name: c.room.name },
      paidAt: c.paidAt,
      paymentId: c.providerPaymentId,
      taxExempt: c.wedding.taxExemptionEnabled,
      escrow: {
        bank: c.wedding.escrowBankName,
        ifsc: c.wedding.escrowIfsc,
        accountLast4: c.wedding.escrowAccountNumber?.slice(-4) ?? null,
        rera: c.wedding.reraRegId,
      },
      wedding: {
        slug: c.wedding.slug,
        brideName: c.wedding.brideName,
        groomName: c.wedding.groomName,
        weddingDate: c.wedding.weddingDate,
        propertyName: c.wedding.propertyName,
      },
      verifyUrl: `${this.env.WEB_PUBLIC_URL.replace(/\/$/, '')}/verify/${c.receiptNumber}`,
    };
  }

  async renderPdf(id: string): Promise<{ filename: string; buffer: Buffer }> {
    const c = await this.load(id);
    if (!c.receiptHash) await this.issueHashOnly(c.id);
    const fresh = await this.load(id);
    const verifyUrl = `${this.env.WEB_PUBLIC_URL.replace(/\/$/, '')}/verify/${fresh.receiptNumber}`;
    const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 220, color: { dark: '#1E232A' } });

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Gift receipt ${fresh.receiptNumber}`, Author: this.env.RECEIPT_ISSUER_NAME } });
    const chunks: Buffer[] = [];
    doc.on('data', (b: Buffer) => chunks.push(b));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const w = fresh.wedding;
    const pageWidth = doc.page.width - 100;
    doc.rect(0, 0, doc.page.width, 8).fill(GOLD);
    doc.fillColor(MAROON).font('Helvetica-Bold').fontSize(22).text('Plot Their Future', 50, 40);
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`${this.env.RECEIPT_ISSUER_NAME} • Wedding Gift Registry`);
    doc.moveDown(1.2);
    doc.fillColor('#1E232A').font('Helvetica-Bold').fontSize(16).text('Thank You Note & Digital Gift Receipt');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Receipt No. ${fresh.receiptNumber}   •   Issued ${fresh.paidAt!.toLocaleString('en-IN', { timeZone: w.timezone })}`);
    doc.moveDown(1);

    const row = (label: string, value: string) => {
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, 50, y, { width: 170 });
      doc.font('Helvetica-Bold').fillColor('#1E232A').text(value, 220, y, { width: pageWidth - 170 });
      doc.moveDown(0.5);
    };
    row('Gift from', `${fresh.donorName}${fresh.relationship ? ` (${fresh.relationship})` : ''}`);
    row('Gift to', `${w.brideName} & ${w.groomName}`);
    if (w.weddingDate) row('Occasion', `Marriage solemnised on ${w.weddingDate.toLocaleDateString('en-IN', { dateStyle: 'long', timeZone: w.timezone })}`);
    row('Property', w.propertyName ?? 'Couple\u2019s first home');
    row('Dedicated area', `${fresh.units} sq.ft. in the ${fresh.room.name}`);
    row('Rate', `${inr(fresh.ratePaise)} per sq.ft.`);
    row('Total gift amount', inr(fresh.amountPaise));
    row('Payment reference', fresh.providerPaymentId ?? '-');
    if (w.escrowBankName) {
      row('Credited to', `RBI-regulated tripartite escrow • ${w.escrowBankName}${w.escrowAccountNumber ? ` • A/c ending ${w.escrowAccountNumber.slice(-4)}` : ''}${w.escrowIfsc ? ` • IFSC ${w.escrowIfsc}` : ''}`);
    }
    if (w.reraRegId) row('Builder RERA registration', w.reraRegId);
    if (fresh.blessing) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Oblique').fontSize(11).fillColor(MAROON).text(`\u201C${fresh.blessing}\u201D`, 50, doc.y, { width: pageWidth });
    }

    if (w.taxExemptionEnabled) {
      doc.moveDown(1);
      const boxY = doc.y;
      doc.roundedRect(50, boxY, pageWidth, 70, 6).lineWidth(1).stroke(GOLD);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1E232A').text('Section 56(2)(x) marriage gift exemption', 62, boxY + 10, { width: pageWidth - 24 });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
        'This is a voluntary gift received on the occasion of the marriage of the recipient. Under the proviso to Section 56(2)(x) of the Income-tax Act, 1961, gifts received on the occasion of marriage are not chargeable to income tax, without any monetary limit.',
        62,
        boxY + 25,
        { width: pageWidth - 24 },
      );
      doc.y = boxY + 80;
    }

    doc.moveDown(1);
    const sealY = doc.y;
    doc.image(qr, 50, sealY, { width: 90 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E232A').text('Tamper-evident seal', 155, sealY);
    doc.font('Courier').fontSize(7.5).fillColor(MUTED).text(`SHA-256 ${fresh.receiptHash}`, 155, sealY + 14, { width: pageWidth - 105 });
    doc.text(`SIG     ${fresh.receiptSignature}`, { width: pageWidth - 105 });
    doc.font('Helvetica').fontSize(8.5).text(`Verify at ${verifyUrl}`, { width: pageWidth - 105 });

    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
      'Gifting on PlotTheirFuture is entirely voluntary. Funds are held in an RBI-regulated escrow account and are disbursed only to the verified RERA developer account or the couple\u2019s home-loan account after dual authorisation.',
      50,
      doc.page.height - 90,
      { width: pageWidth, align: 'center' },
    );
    doc.end();
    return { filename: `${fresh.receiptNumber}.pdf`, buffer: await done };
  }

  private async issueHashOnly(id: string) {
    const c = await this.load(id);
    const hash = sha256(this.canonical(c));
    await ContributionModel.updateOne(
      { _id: id },
      { $set: { receiptHash: hash, receiptSignature: hmacSha256(this.env.RECEIPT_SIGNING_SECRET, hash) } },
    );
  }
}
