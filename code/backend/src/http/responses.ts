import type { ApiError } from '@interviewlab/core';
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-InterviewLab-Mode': 'synthetic-fixture',
};
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}
export function contentJson(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { ...headers, 'X-InterviewLab-Mode': 'curated-public-content' },
  });
}
export function error(code: string, message: string, status: number) {
  const body: ApiError = { code, message, retryable: false, request_id: crypto.randomUUID() };
  return json(body, status);
}
