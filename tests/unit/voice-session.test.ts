import test from 'node:test';
import assert from 'node:assert/strict';
import { InterviewVoiceSession } from '../../code/backend/src/modules/interviews/voice/session';
import { voiceFixture, waitFor } from '../support/voice-fixture';
const identity = async () => ({ owner_id: 'voice-owner', roles: [] });
function create() {
  const f = voiceFixture();
  let disconnected = false;
  const session = new InterviewVoiceSession(
    f.id,
    identity,
    f.service,
    f.provider,
    30,
    (event) => f.events.push(event),
    () => {
      disconnected = true;
    },
  );
  return { ...f, fixture: f, session, disconnected: () => disconnected };
}
async function startListening(f: ReturnType<typeof create>) {
  await f.session.start();
  const speech = f.events.find((e) => e.type === 'speech_start');
  assert.ok(speech?.type === 'speech_start');
  f.session.control({
    type: 'playback',
    speech_id: speech.speech_id,
    played_ms: 100,
    interrupted: false,
  });
  await waitFor(() => f.receipts.length === 1);
}
test('continuous audio uses ASR final plus a silence window, automatically persists a voice answer and preserves the original Agent flow', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.audio(new Uint8Array(6400));
  assert.equal(f.metrics().audioBytes, 6400);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我负责页面性能分析。', final: true });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(f.answers.length, 0, 'ASR final alone must not end a spoken answer');
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  assert.equal(f.answers[0], '我负责页面性能分析。');
  assert.equal(f.fixture.view.turns[0].input_mode, 'voice');
  assert.ok(
    f.events.some((e) => e.type === 'interview' && e.interview.generation_status === 'pending'),
  );
  assert.equal(
    f.speeches[0].signal.aborted,
    true,
    'completed playback releases upstream synthesis',
  );
});
test('hold suppresses automatic submission; explicit done waits for final transcription and overrides hold', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'hold', enabled: true });
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '首先我测量耗时。', final: false });
  f.session.control({ type: 'speech_end' });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(f.answers.length, 0);
  f.session.control({ type: 'commit' });
  await waitFor(() => f.metrics().finishes === 1);
  assert.equal(f.answers.length, 0);
  f.recognize({ text: '首先我测量了耗时。', final: true });
  await waitFor(() => f.answers.length === 1);
  assert.equal(f.answers[0], '首先我测量了耗时。');
});
test('interrupt during Agent generation cancels the old generation and appends to the same answer rather than answering a future question', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  f.session.control({ type: 'speech_start' });
  await waitFor(() =>
    f.events.some((e) => e.type === 'interview' && e.interview.generation_status === 'idle'),
  );
  f.recognize({ text: '补充一下，我还验证了命中率。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.continuations.length === 1);
  assert.equal(f.answers.length, 1);
  assert.equal(f.fixture.view.turns.length, 1);
  assert.equal(f.fixture.view.turns[0].answer_text, '我使用缓存。\n补充一下，我还验证了命中率。');
});
test('late provider audio and recognition are discarded after interrupt/close; ASR error leaves the transcript in the client', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await f.session.start();
  const speech = f.speeches[0];
  speech.audio(new Uint8Array([0, 0]));
  assert.ok(f.events.some((e) => e.type === 'audio'));
  f.session.control({ type: 'interrupt' });
  const count = f.events.filter((e) => e.type === 'audio').length;
  speech.audio(new Uint8Array([0, 0]));
  assert.equal(f.events.filter((e) => e.type === 'audio').length, count);
  f.recognize({ text: '草稿保留。', final: false });
  await waitFor(() => f.events.some((e) => e.type === 'transcript'));
  f.failAsr();
  await waitFor(f.disconnected);
  const end = f.events.length;
  f.recognize({ text: '迟到转写', final: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(f.events.length, end);
  assert.ok(f.events.some((e) => e.type === 'error'));
  assert.equal(f.answers.length, 0);
});
test('pausing remotely tears down provider resources; reconnect reads state and does not submit a stale answer', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await f.session.start();
  const next = f.fixture.view;
  next.status = 'paused';
  next.version++;
  f.fixture.setView(next);
  await waitFor(f.disconnected);
  assert.ok(f.metrics().closes > 0);
  assert.equal(f.speeches[0].signal.aborted, true);
});

test('silence flushes an unfinished ASR result automatically instead of waiting forever for manual submit', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我通过测试验证结果。', final: false });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.metrics().finishes === 1);
  assert.equal(f.answers.length, 0);
  f.recognize({ text: '我通过测试验证结果。', final: true });
  await waitFor(() => f.answers.length === 1);
});
test('resuming speech during an ASR endpoint flush keeps the previous sentence and cancels the premature submit', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用了缓存。', final: false });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.metrics().finishes === 1);
  const closed = f.metrics().closes;
  f.session.control({ type: 'speech_start' });
  await waitFor(() => f.metrics().closes > closed);
  await new Promise((r) => setTimeout(r, 20));
  f.recognize({ text: '还检查了命中率。', final: true });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(f.answers.length, 0);
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  assert.equal(f.answers[0], '我使用了缓存。还检查了命中率。');
});
test('an explicit spoken completion submits the answer without saving the control phrase', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我通过回归测试验证。回答结束。', final: true });
  await waitFor(() => f.answers.length === 1);
  assert.equal(f.answers[0], '我通过回归测试验证。');
});
test('a missing browser speech_end is recovered from subsequent quiet PCM packets', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我负责页面测试。', final: true });
  await new Promise((r) => setTimeout(r, 850));
  f.session.audio(new Uint8Array(6400));
  await waitFor(() => f.answers.length === 1);
});

test('interviewer playback ignores voice, stale recognition and commit until the matching playback receipt', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await f.session.start();
  const speech = f.events.find((e) => e.type === 'speech_start');
  assert.ok(speech?.type === 'speech_start');
  f.session.audio(new Uint8Array(6400).fill(127));
  f.session.control({ type: 'speech_start' });
  f.session.control({ type: 'commit' });
  f.recognize({ text: '扬声器回声', final: true });
  f.speeches[0].finish();
  await waitFor(() => f.events.some((e) => e.type === 'speech_end'));
  f.session.control({ type: 'speech_start' });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(
    f.metrics().audioBytes,
    6400,
    'ASR must receive silent keepalive frames during playback',
  );
  assert.equal(f.metrics().voicedPackets, 0, 'candidate audio must be zeroed before reaching ASR');
  assert.equal(f.metrics().finishes, 0);
  assert.equal(f.answers.length, 0);
  assert.ok(!f.events.some((e) => e.type === 'transcript' || e.type === 'interrupted'));
  f.session.control({
    type: 'playback',
    speech_id: 'stale-output',
    played_ms: 0,
    interrupted: false,
  });
  f.session.control({ type: 'speech_start' });
  assert.equal(f.speeches[0].signal.aborted, false);
  f.session.control({
    type: 'playback',
    speech_id: speech.speech_id,
    played_ms: 100,
    interrupted: false,
  });
  await waitFor(() => f.receipts.length === 1);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '这是听完题目后的回答。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  assert.equal(f.answers[0], '这是听完题目后的回答。');
});
