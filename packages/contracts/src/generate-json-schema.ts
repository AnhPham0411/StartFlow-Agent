import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { runEventSchema } from './schemas.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(currentDirectory, '..', 'run-event.schema.json');
const schema = z.toJSONSchema(runEventSchema, { target: 'draft-7' });

await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
