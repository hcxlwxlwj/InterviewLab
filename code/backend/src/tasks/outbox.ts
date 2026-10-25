import type { Database } from '../database/connection';
import { TASK_QUEUE } from './queue';
export interface QueuePublisher {
  send(
    name: string,
    data: { task_id: string },
    options: {
      retryLimit: number;
      retryDelay: number;
      expireInSeconds: number;
    },
  ): Promise<string | null>;
}
/** Queue delivery may repeat after a crash. Task execution tokens fence result publication. */
export async function dispatchOutbox(database: Database, queue: QueuePublisher, leaseSeconds = 60) {
  return database.transaction(async (tx) => {
    const result = await tx.client.query<{ id: string; task_id: string; max_attempts: number }>(
      "SELECT o.id,o.task_id,t.max_attempts FROM outbox_events o JOIN tasks t ON t.id=o.task_id WHERE o.status='pending' AND o.next_attempt_at<=now() ORDER BY o.created_at,o.id LIMIT 10 FOR UPDATE OF o SKIP LOCKED",
    );
    let published = 0;
    for (const row of result.rows) {
      try {
        const id = await queue.send(
          TASK_QUEUE,
          { task_id: row.task_id },
          {
            // Extra deliveries allow recovery after a lost lease. The task table bounds actual calls.
            retryLimit: row.max_attempts + 2,
            retryDelay: 2,
            expireInSeconds: leaseSeconds,
          },
        );
        if (!id) throw new Error('Queue rejected delivery');
        await tx.client.query(
          "UPDATE outbox_events SET status='published',published_at=now(),attempts=attempts+1 WHERE id=$1",
          [row.id],
        );
        published++;
      } catch {
        await tx.client.query(
          "UPDATE outbox_events SET attempts=attempts+1,next_attempt_at=now()+interval '2 seconds' WHERE id=$1",
          [row.id],
        );
      }
    }
    return published;
  });
}
