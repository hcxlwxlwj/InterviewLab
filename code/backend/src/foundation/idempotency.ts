import { createHash, randomUUID } from 'node:crypto';
import type { Database, Transaction } from '../database/connection';
import { ServiceError } from './errors';

/** JSON wire inputs only; recursive key sorting makes equivalent objects hash identically. */
export function inputDigest(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b, 'en'))
          .map(([key, value]) => [key, canonical(value)]),
      );
    return item;
  };
  const encoded = JSON.stringify(canonical(value));
  if (encoded === undefined)
    throw new ServiceError('unsupported_input', 400, 'Expected JSON input');
  return createHash('sha256').update(encoded).digest('hex');
}
export function assertIdempotencyKey(key: string) {
  if (!key.trim() || key.length > 128)
    throw new ServiceError('unsupported_input', 400, 'Invalid Idempotency-Key');
}
/** work may perform database writes only; provider/network calls must stay outside this transaction. */
export async function withIdempotency<T>(
  database: Database,
  scope: {
    owner_id: string;
    operation: string;
    key: string;
    input: unknown;
  },
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  assertIdempotencyKey(scope.key);
  const digest = inputDigest(scope.input);
  return database.transaction(async (tx) => {
    const lock = JSON.stringify([scope.owner_id, scope.operation, scope.key]);
    await tx.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lock]);
    const existing = await tx.client.query(
      'SELECT input_digest, response FROM idempotency_records WHERE owner_id=$1 AND operation=$2 AND key=$3',
      [scope.owner_id, scope.operation, scope.key],
    );
    if (existing.rowCount) {
      if (existing.rows[0].input_digest !== digest)
        throw new ServiceError(
          'version_conflict',
          409,
          'Idempotency-Key was already used with different input',
        );
      return existing.rows[0].response as T;
    }
    const response = await work(tx);
    const json = JSON.stringify(response);
    if (json === undefined) throw new Error('Idempotent operations must return a JSON response');
    await tx.client.query(
      'INSERT INTO idempotency_records (id, owner_id, operation, key, input_digest, response) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [randomUUID(), scope.owner_id, scope.operation, scope.key, digest, json],
    );
    return JSON.parse(json) as T;
  });
}
