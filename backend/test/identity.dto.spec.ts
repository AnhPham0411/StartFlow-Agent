import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAccountDto, CreateBranchDto } from '../src/modules/identity/dto/identity.dto';

describe('Identity DTO contract parity', () => {
  it('accepts the shared 32-character branch-code boundary', async () => {
    const dto = plainToInstance(CreateBranchDto, {
      code: 'A'.repeat(32),
      name: 'Demo branch',
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('rejects one-character names at the HTTP boundary', async () => {
    const branchErrors = await validate(
      plainToInstance(CreateBranchDto, { code: 'HN-01', name: 'A' }),
    );
    const accountErrors = await validate(
      plainToInstance(CreateAccountDto, {
        username: 'employee.demo',
        full_name: 'A',
        role: 'employee',
        branch_id: 1,
      }),
    );

    expect(branchErrors.some((error) => error.property === 'name')).toBe(true);
    expect(accountErrors.some((error) => error.property === 'full_name')).toBe(true);
  });
});
