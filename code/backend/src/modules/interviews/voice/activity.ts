import type { RequestIdentity } from '@interviewlab/core';
import type { Database } from '../../../database/connection';
import { ServiceError } from '../../../foundation/errors';
import type { Executor } from '../repository';

export interface VoiceInputActivity {
  session_id: string;
  turn_id: string;
  generation_id: string;
  active: boolean;
}
type Leases = Record<
  string,
  Omit<VoiceInputActivity, 'session_id' | 'active'> & { expires_at: string }
>;

/** Private delivery state: never part of the interview version, model input or answer evidence. */
export async function setVoiceInputActivity(
  database: Database,
  identity: RequestIdentity,
  id: string,
  activity: VoiceInputActivity,
) {
  return database.transaction(async (tx) => {
    const result = await tx.client.query<{
      status: string;
      generation_id: string | null;
      generation_status: string;
      voice_activity: Leases;
      turn_id: string | null;
      answer_status: string | null;
    }>(
      `SELECT i.status,i.generation_id,i.generation_status,i.voice_activity,t.id AS turn_id,t.answer_status
       FROM interviews i LEFT JOIN LATERAL (SELECT id,answer_status FROM interview_turns WHERE interview_id=i.id ORDER BY main_question_index DESC,follow_up_index DESC LIMIT 1) t ON true
       WHERE i.id=$1 AND i.owner_id=$2 AND i.deleted_at IS NULL FOR UPDATE OF i`,
      [id, identity.owner_id],
    );
    const state = result.rows[0];
    if (!state) throw new ServiceError('not_found', 404, '面试不存在或不可访问');
    if (
      activity.active &&
      (state.status !== 'in_progress' ||
        state.generation_status !== 'pending' ||
        state.generation_id !== activity.generation_id ||
        state.turn_id !== activity.turn_id ||
        state.answer_status !== 'answered')
    )
      return false;
    const now = Date.now();
    const leases: Leases = Object.fromEntries(
      Object.entries(state.voice_activity ?? {}).filter(
        ([, lease]) => Date.parse(lease.expires_at) > now,
      ),
    );
    if (activity.active)
      leases[activity.session_id] = {
        turn_id: activity.turn_id,
        generation_id: activity.generation_id,
        expires_at: new Date(now + 5000).toISOString(),
      };
    else if (
      leases[activity.session_id]?.generation_id === activity.generation_id &&
      leases[activity.session_id]?.turn_id === activity.turn_id
    )
      delete leases[activity.session_id];
    await tx.client.query('UPDATE interviews SET voice_activity=$2::jsonb WHERE id=$1', [
      id,
      JSON.stringify(leases),
    ]);
    return true;
  });
}

export async function voicePublicationReady(
  db: Executor,
  id: string,
  generation: string,
  turnId: string,
) {
  const result = await db.query<{ ready: boolean }>(
    `SELECT NOT EXISTS (SELECT 1 FROM jsonb_each(voice_activity) AS lease WHERE lease.value->>'generation_id'=$2 AND lease.value->>'turn_id'=$3 AND (lease.value->>'expires_at')::timestamptz > clock_timestamp()) AS ready FROM interviews WHERE id=$1`,
    [id, generation, turnId],
  );
  return result.rows[0]?.ready ?? true;
}
