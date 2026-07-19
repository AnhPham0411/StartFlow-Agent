import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const ROLES = ['employee', 'manager', 'admin'] as const;

export class CreateBranchDto {
  @IsString()
  @Matches(/^[A-Z0-9-]{2,32}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;
}

export class UpdateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class CreateAccountDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,64}$/)
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  full_name!: string;

  @IsIn(ROLES as unknown as string[])
  role!: (typeof ROLES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  branch_id?: number;
}

export class UpdateAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  full_name!: string;

  @IsIn(ROLES as unknown as string[])
  role!: (typeof ROLES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  branch_id?: number;
}
