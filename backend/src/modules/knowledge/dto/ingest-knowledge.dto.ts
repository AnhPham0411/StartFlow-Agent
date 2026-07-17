import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsIn, IsString, Length } from 'class-validator';

export class IngestKnowledgeDto {
  @ApiProperty({ maxLength: 200, minLength: 3 })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 200)
  title!: string;

  @ApiProperty({ enum: ['CREDIT', 'COMPLIANCE', 'OPERATIONS'] })
  @IsIn(['CREDIT', 'COMPLIANCE', 'OPERATIONS'])
  domain!: 'CREDIT' | 'COMPLIANCE' | 'OPERATIONS';

  @ApiProperty({ maxLength: 50_000, minLength: 20 })
  @IsString()
  @Length(20, 50_000)
  content!: string;

  @ApiProperty({ enum: [true], example: true })
  @Equals(true)
  demoData!: true;
}
