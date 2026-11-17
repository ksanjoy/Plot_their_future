import { idString } from '../database/helpers.js';

/** Canonical, order-stable representation that the receipt hash commits to. */
export function canonicalReceipt(c: {
  id: string;
  receiptNumber: string | null;
  weddingId: unknown;
  donorName: string;
  units: number;
  ratePaise: number;
  amountPaise: number;
  room: { key: string };
  paidAt: Date | null;
  providerPaymentId: string | null;
}) {
  return JSON.stringify({
    receiptNumber: c.receiptNumber,
    contributionId: c.id,
    weddingId: idString(c.weddingId),
    donorName: c.donorName,
    units: c.units,
    ratePaise: c.ratePaise,
    amountPaise: c.amountPaise,
    room: c.room.key,
    paidAt: c.paidAt?.toISOString(),
    paymentId: c.providerPaymentId,
  });
}
