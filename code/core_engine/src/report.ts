import type { Dimension, DimensionKey } from './domain/interview';
export function overallScore(dimensions: Record<DimensionKey, Dimension>): number | null {
  const observed = Object.values(dimensions).filter(
    (d) => d.status === 'observed' && d.score !== null,
  );
  return observed.length
    ? Math.round(observed.reduce((sum, d) => sum + d.score!, 0) / observed.length)
    : null;
}
