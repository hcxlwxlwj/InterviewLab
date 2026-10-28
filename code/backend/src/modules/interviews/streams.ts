import { Client } from 'pg';
import type { InterviewPreview } from '@interviewlab/core';
import type { Database } from '../../database/connection';
import type { TaskRow } from '../../tasks/service';
export function createGenerationStreams(database: Database) {
  const subscribers = new Map<string, Set<() => void>>();
  let listener: Client | undefined;
  let connecting: Promise<void> | undefined;
  let closed = false;
  async function listen() {
    if (listener) return;
    if (connecting) return connecting;
    connecting = (async () => {
      const client = new Client(database.pool.options);
      await client.connect();
      if (closed) {
        await client.end();
        return;
      }
      listener = client;
      client.on('notification', (n) => {
        if (n.channel === 'interview_generation' && n.payload)
          subscribers.get(n.payload)?.forEach((fn) => fn());
      });
      client.on('error', () => {
        if (listener === client) {
          listener = undefined;
          void client.end().catch(() => {});
          connecting = undefined;
          subscribers.forEach((set) => set.forEach((fn) => fn()));
        }
      });
      await client.query('LISTEN interview_generation');
    })().finally(() => {
      connecting = undefined;
    });
    return connecting;
  }
  return {
    async subscribe(id: string, notify: () => void) {
      await listen();
      const set = subscribers.get(id) ?? new Set();
      set.add(notify);
      subscribers.set(id, set);
      return () => {
        set.delete(notify);
        if (!set.size) subscribers.delete(id);
      };
    },
    async preview(task: Readonly<TaskRow>, generation: string, value: InterviewPreview) {
      const input = task.payload as { interview_id: string };
      await database.transaction(async (tx) => {
        // Serialize against pause/delete, then verify this exact worker claim. A late producer cannot recreate private previews.
        const live = await tx.client.query(
          `SELECT i.id FROM interviews i JOIN tasks t ON t.id=i.task_id WHERE i.id=$1 AND i.owner_id=$2 AND i.generation_id=$3 AND i.generation_status='pending' AND i.status='in_progress' AND i.deleted_at IS NULL AND t.status='running' AND t.execution_token=$4 AND t.lease_until>now() FOR UPDATE OF i`,
          [input.interview_id, task.owner_id, generation, task.execution_token],
        );
        if (!live.rowCount) return;
        await tx.client.query(
          `INSERT INTO interview_generation_streams(interview_id,generation_id,execution_token,acknowledgement,text) VALUES($1,$2,$3,$4,$5) ON CONFLICT(interview_id) DO UPDATE SET generation_id=EXCLUDED.generation_id,execution_token=EXCLUDED.execution_token,acknowledgement=EXCLUDED.acknowledgement,text=EXCLUDED.text,updated_at=now()`,
          [input.interview_id, generation, task.execution_token, value.acknowledgement, value.text],
        );
        await tx.client.query("SELECT pg_notify('interview_generation',$1)", [input.interview_id]);
      });
    },
    async read(id: string, generation: string) {
      const result = await database.pool.query<{ acknowledgement: string; text: string }>(
        `SELECT acknowledgement,text FROM interview_generation_streams WHERE interview_id=$1 AND generation_id=$2 AND updated_at>now()-interval '15 minutes'`,
        [id, generation],
      );
      return result.rows[0] ?? null;
    },
    async cleanup() {
      await database.pool.query(
        "DELETE FROM interview_generation_streams s WHERE updated_at<now()-interval '15 minutes' OR NOT EXISTS(SELECT 1 FROM interviews i WHERE i.id=s.interview_id AND i.generation_id=s.generation_id AND i.generation_status='pending' AND i.status='in_progress')",
      );
    },
    async close() {
      closed = true;
      await connecting?.catch(() => {});
      if (listener) {
        await listener.query('UNLISTEN interview_generation').catch(() => {});
        await listener.end();
        listener = undefined;
      }
    },
  };
}
