import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  Equals,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { CaseInput } from '@startflow/contracts';

export class FinancialSnapshotDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  revenue!: number;

  @ApiProperty()
  @IsNumber()
  ebitda!: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  totalDebt!: number;

  @ApiProperty({ exclusiveMinimum: true, minimum: 0 })
  @IsNumber()
  @IsPositive()
  equity!: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  currentAssets!: number;

  @ApiProperty({ exclusiveMinimum: true, minimum: 0 })
  @IsNumber()
  @IsPositive()
  currentLiabilities!: number;
}

export class CreateCaseDto implements CaseInput {
  @ApiProperty({ example: 'Công ty Cổ phần Sao Mai Demo', maxLength: 160, minLength: 2 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 160)
  companyName!: string;

  @ApiProperty({ example: 'DEMO-01010101', maxLength: 32, minLength: 4 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(4, 32)
  registrationNumber!: string;

  @ApiProperty({ exclusiveMinimum: true, minimum: 0 })
  @IsNumber()
  @IsPositive()
  requestedAmount!: number;

  @ApiProperty({ maxLength: 1000, minLength: 10 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(10, 1000)
  purpose!: string;

  @ApiProperty({ type: FinancialSnapshotDto })
  @ValidateNested()
  @Type(() => FinancialSnapshotDto)
  financials!: FinancialSnapshotDto;

  @ApiProperty({ type: [String] })
  @IsArray()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(2, 120, { each: true })
  submittedDocuments!: string[];

  @ApiProperty({ enum: [true], example: true })
  @Equals(true)
  demoData!: true;
}
