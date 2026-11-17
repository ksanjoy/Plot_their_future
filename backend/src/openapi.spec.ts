import { z } from 'zod';
import { zodOpenApiConverter } from './openapi.js';

describe('zodOpenApiConverter', () => {
  it('documents coerced dates as ISO date-time strings', () => {
    const schema = z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date().nullable().optional() });
    const result = zodOpenApiConverter(schema, { schemaType: 'input' });
    expect(result).toBeDefined();
    const props = (result!.schema as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props.startsAt).toMatchObject({ type: 'string', format: 'date-time' });
    expect(JSON.stringify(props.endsAt)).toContain('date-time');
  });

  it('ignores values that are not zod schemas', () => {
    expect(zodOpenApiConverter({}, { schemaType: 'input' })).toBeUndefined();
  });
});
