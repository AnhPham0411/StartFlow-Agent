import { ApiProperty } from '@nestjs/swagger';
import type { ApprovalRequest } from '@startflow/contracts';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Min } from 'class-validator';

export class CreateApprovalDto implements ApprovalRequest {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ApiProperty({ maxLength: 1000, minLength: 5 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(5, 1000)
  reason!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
