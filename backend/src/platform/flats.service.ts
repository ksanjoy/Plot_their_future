import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { slugify } from '../common/utils/format.js';
import { AuditLogModel, FlatAreaModel, FlatModel, type FlatDoc } from '../models/schemas.js';
import type { FlatStatus } from '../models/types.js';

export interface AreaInput {
  name: string;
  sft: number;
  description?: string | null;
  icon?: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface FlatInput {
  name: string;
  projectName?: string | null;
  location: string;
  description?: string | null;
  flatType: string;
  pricePerSft: number;
  brickRatio?: number;
  floorPlanUrl?: string | null;
  photos?: string[];
  amenities?: string[];
  highlights?: string[];
  targetAmount: number;
  minGift?: number;
  areas: AreaInput[];
}

@Injectable()
export class FlatsService {
  private view(flat: FlatDoc, areas: { id: string; key: string; name: string; sft: number; description: string | null; icon: string | null; sortOrder: number; x: number; y: number; w: number; h: number }[]) {
    return {
      id: flat.id,
      name: flat.name,
      projectName: flat.projectName,
      location: flat.location,
      description: flat.description,
      flatType: flat.flatType,
      totalSft: flat.totalSft,
      pricePerSftPaise: flat.pricePerSftPaise,
      brickRatio: flat.brickRatio,
      floorPlanUrl: flat.floorPlanUrl,
      photos: flat.photos,
      amenities: flat.amenities,
      highlights: flat.highlights,
      totalPricePaise: flat.totalPricePaise,
      targetAmountPaise: flat.targetAmountPaise,
      minGiftPaise: flat.minGiftPaise,
      status: flat.status,
      reservedWeddingId: flat.reservedWeddingId,
      areas,
      createdAt: flat.createdAt,
      updatedAt: flat.updatedAt,
    };
  }

  private async withAreas(flat: FlatDoc) {
    const areas = await FlatAreaModel.find({ flatId: flat._id }).sort({ sortOrder: 1 });
    return this.view(
      flat,
      areas.map((area) => ({
        id: area.id,
        key: area.key,
        name: area.name,
        sft: area.sft,
        description: area.description,
        icon: area.icon,
        sortOrder: area.sortOrder,
        x: area.x,
        y: area.y,
        w: area.w,
        h: area.h,
      })),
    );
  }

  async list(status?: FlatStatus) {
    const rows = await FlatModel.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200);
    return Promise.all(rows.map((flat) => this.withAreas(flat)));
  }

  async available() {
    return this.list('AVAILABLE');
  }

  async get(id: string) {
    const flat = await FlatModel.findById(id);
    if (!flat || flat.status === 'ARCHIVED') throw new NotFoundException('Flat not found');
    return this.withAreas(flat);
  }

  async create(actorId: string, input: FlatInput) {
    const totalSft = input.areas.reduce((sum, area) => sum + area.sft, 0);
    const pricePerSftPaise = input.pricePerSft * 100;
    const flat = await FlatModel.create({
      name: input.name,
      projectName: input.projectName ?? null,
      location: input.location,
      description: input.description ?? null,
      flatType: input.flatType,
      totalSft,
      pricePerSftPaise,
      brickRatio: input.brickRatio ?? 10,
      floorPlanUrl: input.floorPlanUrl || null,
      photos: input.photos ?? [],
      amenities: input.amenities ?? [],
      highlights: input.highlights ?? [],
      totalPricePaise: totalSft * pricePerSftPaise,
      targetAmountPaise: Math.round(input.targetAmount * 100),
      minGiftPaise: Math.round((input.minGift ?? 0) * 100),
      status: 'AVAILABLE',
    });
    await this.replaceAreas(flat.id, input.areas);
    await AuditLogModel.create({ actorId, action: 'flat.create', entityType: 'flat', entityId: flat.id, meta: { name: flat.name } });
    return this.withAreas(flat);
  }

  async update(actorId: string, id: string, input: Partial<FlatInput> & { status?: 'AVAILABLE' | 'COMPLETED' }) {
    const flat = await FlatModel.findById(id);
    if (!flat) throw new NotFoundException('Flat not found');
    if (flat.status === 'RESERVED' && input.areas) {
      throw new ConflictException({ code: 'FLAT_RESERVED', message: 'A reserved flat layout cannot be edited' });
    }
    const areas = input.areas;
    const totalSft = areas ? areas.reduce((sum, area) => sum + area.sft, 0) : flat.totalSft;
    const pricePerSftPaise = input.pricePerSft !== undefined ? input.pricePerSft * 100 : flat.pricePerSftPaise;
    const patch: Record<string, unknown> = {
      totalSft,
      pricePerSftPaise,
      totalPricePaise: totalSft * pricePerSftPaise,
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.projectName !== undefined) patch.projectName = input.projectName;
    if (input.location !== undefined) patch.location = input.location;
    if (input.description !== undefined) patch.description = input.description;
    if (input.flatType !== undefined) patch.flatType = input.flatType;
    if (input.brickRatio !== undefined) patch.brickRatio = input.brickRatio;
    if (input.floorPlanUrl !== undefined) patch.floorPlanUrl = input.floorPlanUrl || null;
    if (input.photos !== undefined) patch.photos = input.photos;
    if (input.amenities !== undefined) patch.amenities = input.amenities;
    if (input.highlights !== undefined) patch.highlights = input.highlights;
    if (input.targetAmount !== undefined) patch.targetAmountPaise = Math.round(input.targetAmount * 100);
    if (input.minGift !== undefined) patch.minGiftPaise = Math.round(input.minGift * 100);
    if (input.status !== undefined) patch.status = input.status;
    const updated = await FlatModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!updated) throw new NotFoundException('Flat not found');
    if (areas) await this.replaceAreas(updated.id, areas);
    await AuditLogModel.create({ actorId, action: 'flat.update', entityType: 'flat', entityId: id, meta: { status: updated.status } });
    return this.withAreas(updated);
  }

  async archive(actorId: string, id: string) {
    const flat = await FlatModel.findById(id);
    if (!flat) throw new NotFoundException('Flat not found');
    if (flat.status === 'RESERVED') throw new ConflictException({ code: 'FLAT_RESERVED', message: 'Release the wedding before archiving this flat' });
    const updated = await FlatModel.findByIdAndUpdate(id, { $set: { status: 'ARCHIVED' } }, { new: true });
    if (!updated) throw new NotFoundException('Flat not found');
    await AuditLogModel.create({ actorId, action: 'flat.archive', entityType: 'flat', entityId: id, meta: {} });
    return this.withAreas(updated);
  }

  private async replaceAreas(flatId: string, areas: AreaInput[]) {
    await FlatAreaModel.deleteMany({ flatId });
    const used = new Set<string>();
    const docs = areas.map((area, sortOrder) => {
      let key = slugify(area.name).replace(/-/g, '_').slice(0, 40);
      if (key.length < 2) key = `area_${sortOrder + 1}`;
      while (used.has(key)) key = `${key}_${sortOrder + 1}`.slice(0, 40);
      used.add(key);
      return {
        flatId,
        key,
        name: area.name,
        sft: area.sft,
        description: area.description ?? null,
        icon: area.icon ?? null,
        sortOrder,
        x: area.x ?? 0,
        y: area.y ?? sortOrder * 12,
        w: area.w ?? 30,
        h: area.h ?? 10,
      };
    });
    await FlatAreaModel.insertMany(docs);
  }
}
