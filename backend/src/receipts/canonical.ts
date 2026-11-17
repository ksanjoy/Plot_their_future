import type { Contribution, RoomZone } from '../generated/prisma/client.js';

/** Canonical, order-stable representation that the receipt hash commits to. */
export function canonicalReceipt(c: Contribution & { room: Pick<RoomZone, 'key'> }) {
  return JSON.stringify({
    receiptNumber: c.receiptNumber,
    contributionId: c.id,
    weddingId: c.weddingId,
    donorName: c.donorName,
    units: c.units,
    ratePaise: c.ratePaise,
    amountPaise: c.amountPaise,
    room: c.room.key,
    paidAt: c.paidAt?.toISOString(),
    paymentId: c.providerPaymentId,
  });
}
