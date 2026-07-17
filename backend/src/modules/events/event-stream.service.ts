import { Injectable, type MessageEvent } from '@nestjs/common';
import type { RunEvent } from '@prisma/client';
import { Observable, Subject, type Subscription } from 'rxjs';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EventStreamService {
  private readonly channels = new Map<string, Subject<RunEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  publish(event: RunEvent): void {
    const channel = this.channel(event.runId);
    channel.next(event);
    if (event.type === 'run.completed' || event.type === 'run.failed') {
      channel.complete();
      this.channels.delete(event.runId);
    }
  }

  stream(runId: string, afterSequence: number): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      let historyLoaded = false;
      let watermark = afterSequence;
      const pending: RunEvent[] = [];
      let liveSubscription: Subscription | undefined;

      liveSubscription = this.channel(runId).subscribe((event) => {
        if (!historyLoaded) {
          pending.push(event);
          return;
        }
        if (event.sequence > watermark) {
          watermark = event.sequence;
          subscriber.next(this.toMessage(event));
        }
      });

      void this.prisma.runEvent
        .findMany({
          where: { runId, sequence: { gt: afterSequence } },
          orderBy: { sequence: 'asc' },
        })
        .then((history) => {
          if (closed) return;
          for (const event of history) {
            if (event.sequence > watermark) {
              watermark = event.sequence;
              subscriber.next(this.toMessage(event));
            }
          }
          historyLoaded = true;
          pending.sort((left, right) => left.sequence - right.sequence);
          for (const event of pending) {
            if (event.sequence > watermark) {
              watermark = event.sequence;
              subscriber.next(this.toMessage(event));
            }
          }
        })
        .catch((error: unknown) => subscriber.error(error));

      return () => {
        closed = true;
        liveSubscription?.unsubscribe();
      };
    });
  }

  private channel(runId: string): Subject<RunEvent> {
    const existing = this.channels.get(runId);
    if (existing) return existing;
    const created = new Subject<RunEvent>();
    this.channels.set(runId, created);
    return created;
  }

  private toMessage(event: RunEvent): MessageEvent {
    return {
      id: String(event.sequence),
      type: event.type,
      data: {
        ...event,
        createdAt: event.createdAt.toISOString(),
        occurredAt: event.occurredAt.toISOString(),
      },
    };
  }
}
