import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { runEventSchema } from './schemas.js';
import {
  accountSchema,
  branchSchema,
  createAccountInputSchema,
  createBranchInputSchema,
  currentIdentitySchema,
  customerListItemSchema,
  nbaBatchRunSchema,
  nbaModelVersionSchema,
  nbaRunRequestSchema,
  updateAccountInputSchema,
  updateBranchInputSchema,
} from './nba.schemas.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(currentDirectory, '..', 'run-event.schema.json');
const schema = z.toJSONSchema(runEventSchema, { target: 'draft-7' });
const nbaOutputPath = resolve(currentDirectory, '..', 'nba-contracts.schema.json');
const nbaSchema = z.toJSONSchema(
  z.object({
    branch: branchSchema,
    account: accountSchema,
    current_identity: currentIdentitySchema,
    customer_list_item: customerListItemSchema,
    create_branch: createBranchInputSchema,
    update_branch: updateBranchInputSchema,
    create_account: createAccountInputSchema,
    update_account: updateAccountInputSchema,
    run_request: nbaRunRequestSchema,
    batch_run: nbaBatchRunSchema,
    model_version: nbaModelVersionSchema,
  }),
  { target: 'draft-7' },
);

await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
await writeFile(nbaOutputPath, `${JSON.stringify(nbaSchema, null, 2)}\n`, 'utf8');
