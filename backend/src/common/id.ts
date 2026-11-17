import { z } from 'zod';

/** Public ids are MongoDB ObjectId hex strings. */
export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
