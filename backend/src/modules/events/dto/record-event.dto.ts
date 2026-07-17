import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export const publicEventTypes = [
  'run.started',
  'plan.created',
  'agent.started',
  'tool.completed',
  'citation.added',
  'agent.completed',
  'synthesis.completed',
  'approval.required',
  'run.completed',
  'run.failed',
] as const;

export const agentKinds = ['PLANNER', 'CREDIT', 'COMPLIANCE', 'OPERATIONS', 'SYNTHESIZER'] as const;

export type PublicEventType = (typeof publicEventTypes)[number];

export class RecordEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  runId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiProperty({ enum: publicEventTypes })
  @IsIn(publicEventTypes)
  type!: PublicEventType;

  @ApiProperty({ enum: agentKinds, nullable: true, required: false })
  @IsOptional()
  @IsIn(agentKinds)
  agent?: (typeof agentKinds)[number] | null;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  correlationId!: string;

  @ApiProperty({ maxLength: 200, minLength: 8 })
  @IsString()
  @Length(8, 200)
  idempotencyKey!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;
}
