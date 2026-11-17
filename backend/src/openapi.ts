import type { StandardSchemaConverter } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Zod's built-in Standard JSON Schema export throws on types JSON Schema cannot express
 * (dates, transforms, custom refinements). Documented dates are ISO-8601 strings on the wire.
 */
export const zodOpenApiConverter: StandardSchemaConverter = (schema, { schemaType }) => {
  if (!(schema instanceof z.ZodType)) return undefined;
  const { $defs, $schema: _ignored, ...json } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: schemaType,
    unrepresentable: 'any',
    override: (ctx) => {
      if (ctx.zodSchema._zod.def.type === 'date') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'date-time';
      }
    },
  });
  return { schema: json, components: ($defs ?? {}) as Record<string, object> };
};
