import type { ClientSession } from 'mongoose';
import { FloorTileModel, RoomZoneModel } from '../models/schemas.js';

export interface RoomInput {
  key: string;
  name: string;
  sft: number;
  description?: string | null;
  icon?: string | null;
}

/** Default 2 BHK layout from the admin intake specification (1,200 SFT). */
export const DEFAULT_2BHK_ROOMS: RoomInput[] = [
  { key: 'living_room', name: 'Living & Dining', sft: 400, icon: 'weekend', description: 'The vibrant heart of the home for morning chai, family gatherings, and festivals.' },
  { key: 'master_bedroom', name: 'Master Bedroom', sft: 250, icon: 'king_bed', description: 'A peaceful haven for restful nights and sweet dreams for the newlyweds.' },
  { key: 'balcony', name: 'Balcony', sft: 80, icon: 'balcony', description: 'Sunset vista and potted garden for evening breezes and endless conversations.' },
  { key: 'kitchen', name: 'Kitchen', sft: 120, icon: 'kitchen', description: 'Where traditional aroma and modern recipes combine to feed a happy life.' },
  { key: 'bedroom_2', name: 'Bedroom 2', sft: 200, icon: 'single_bed', description: 'Comfortable guest sanctuary ensuring parents and relatives are always welcomed.' },
  { key: 'utility', name: 'Bathrooms & Utility', sft: 150, icon: 'bathtub', description: 'Essential utility, smart storage, and refreshing wellness spaces.' },
];

/** Creates rooms and one tile per square foot, numbered continuously across rooms. */
export async function createRoomsAndTiles(session: ClientSession, weddingId: string, rooms: RoomInput[]) {
  let index = 0;
  for (const [sortOrder, room] of rooms.entries()) {
    const [created] = await RoomZoneModel.create(
      [
        {
          weddingId,
          key: room.key,
          name: room.name,
          sft: room.sft,
          description: room.description ?? null,
          icon: room.icon ?? null,
          sortOrder,
        },
      ],
      { session },
    );
    if (!created) throw new Error('Failed to create room');
    const tiles = Array.from({ length: room.sft }, () => ({ weddingId, roomId: created._id, index: index++ }));
    for (let i = 0; i < tiles.length; i += 1000) {
      await FloorTileModel.insertMany(tiles.slice(i, i + 1000), { session });
    }
  }
  return index;
}
