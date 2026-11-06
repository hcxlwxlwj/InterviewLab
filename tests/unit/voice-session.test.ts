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

for (const duration of [20, 30] as const)
  test(`${duration}-minute voice transport remains connected beyond twelve minutes and obeys its interview deadline`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
    const f = create();
    try {
      const remaining = (duration + 2) * 60000;
      f.fixture.setView({
        ...f.fixture.view,
        configuration: { ...f.fixture.view.configuration, duration_minutes: duration },
        deadline_at: new Date(Date.now() + remaining).toISOString(),
      });
      await f.session.start();
      t.mock.timers.tick(13 * 60000);
      assert.equal(f.disconnected(), false);
      t.mock.timers.tick(remaining - 13 * 60000);
      assert.equal(f.disconnected(), true);
    } finally {
      f.session.close();
      t.mock.timers.reset();
    }
  });

test('voice reconnect uses remaining deadline instead of granting a new full session', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const f = create();
  try {
    f.fixture.setView({
      ...f.fixture.view,
      configuration: { ...f.fixture.view.configuration, duration_minutes: 20 },
      deadline_at: new Date(Date.now() + 14000).toISOString(),
    });
    await f.session.start();
    t.mock.timers.tick(13999);
    assert.equal(f.disconnected(), false);
    t.mock.timers.tick(1);
    assert.equal(f.disconnected(), true);
  } finally {
    f.session.close();
    t.mock.timers.reset();
  }
});
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
test('confirmed speech replaces pending generation atomically and appends to the same answer', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  f.session.control({ type: 'speech_start' });
  await waitFor(() => f.activities.some((activity) => activity.active));
  assert.equal(
    f.metrics().interruptions,
    0,
    'VAD reserves publication without cancelling the model',
  );
  f.recognize({ text: '补充一下，我还验证了命中率。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.continuations.length === 1);
  assert.equal(f.answers.length, 1);
  assert.equal(f.fixture.view.turns.length, 1);
  assert.equal(f.fixture.view.turns[0].answer_text, '我使用缓存。\n补充一下，我还验证了命中率。');
  assert.equal(
    f.metrics().interruptions,
    0,
    'there is no cancelled-but-unsubmitted generation gap',
  );
  assert.ok(f.activities.some((activity) => !activity.active));
});

test('noise-only VAD and an empty ASR endpoint release publication without cancelling or starting an empty continuation', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  const generation = f.fixture.view.generation_id;
  f.session.control({ type: 'speech_start' });
  await waitFor(() => f.activities.some((activity) => activity.active));
  f.recognize({ text: '', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.activities.some((activity) => !activity.active), 2000);
  assert.equal(f.metrics().interruptions, 0);
  assert.equal(f.continuations.length, 0);
  assert.equal(f.fixture.view.generation_id, generation);
  assert.equal(f.fixture.view.generation_status, 'pending');
});

test('old recognizer packets and a replay of the submitted answer do not cancel pending generation', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  const previous = f.metrics().recognizers - 1;
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.metrics().recognizers > previous + 1);
  f.recognizeAt(previous, { text: '旧epoch迟到的转写。', final: true });
  f.recognize({ text: '我使用缓存。', final: true });
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(f.metrics().interruptions, 0);
  assert.equal(f.continuations.length, 0);
  assert.equal(f.fixture.view.turns[0].revision, 1);
});

test('continued speech renews its publication reservation and closing releases it without cancelling the model', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  f.session.control({ type: 'speech_start' });
  await waitFor(() => f.activities.filter((activity) => activity.active).length >= 2, 1500);
  assert.equal(f.metrics().interruptions, 0);
  f.session.close();
  await waitFor(() => f.activities.some((activity) => !activity.active));
  assert.equal(f.metrics().interruptions, 0);
});

test('reconnecting to an already interrupted answer never starts an empty continuation after a noise pulse', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  const current = f.fixture.view;
  current.generation_status = 'idle';
  current.turns[0].answer_status = 'answered';
  current.turns[0].answer_text = '已经提交的回答。';
  current.turns[0].revision = 1;
  f.fixture.setView(current);
  await f.session.start();
  f.session.control({ type: 'speech_start' });
  f.session.control({ type: 'speech_end' });
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(f.continuations.length, 0);
  assert.equal(f.fixture.view.turns[0].revision, 1);
});

test('a rejected input reservation keeps a late supplement on its old question as a draft', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  const next = f.fixture.view;
  const previous = next.turns[0].id;
  next.turns.push({
    ...next.turns[0],
    id: 'future-question',
    text: '接下来你如何验证？',
    answer_text: null,
    answer_status: 'waiting',
    revision: 0,
    main_question_index: 2,
  });
  next.generation_status = 'ready';
  next.version++;
  f.fixture.setView(next);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '补充一下，我也验证过命中率。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() =>
    f.events.some((event) => event.type === 'error' && event.code === 'voice_previous_draft'),
  );
  const transcript = f.events.filter((event) => event.type === 'transcript').at(-1);
  assert.ok(transcript?.type === 'transcript');
  assert.equal(transcript.turn_id, previous);
  assert.equal(f.metrics().interruptions, 0);
  assert.equal(f.answers.length, 1);
  assert.equal(f.continuations.length, 0);
  assert.equal(f.disconnected(), false);
  await waitFor(() => f.speeches.length === 2);
  assert.equal(f.fixture.view.turns.at(-1)?.id, 'future-question');
  assert.equal(
    f.continuations.length,
    0,
    'the independent old draft does not block the new spoken question',
  );
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

test('a tentative supplement withdrawn by the final transcript leaves the original generation running', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  const generation = f.fixture.view.generation_id;
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '可能的误识别', final: false });
  await waitFor(() => f.events.some((e) => e.type === 'transcript' && e.text === '可能的误识别'));
  assert.equal(f.fixture.view.generation_status, 'pending');
  f.recognize({ text: '', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.activities.some((a) => !a.active));
  assert.equal(f.fixture.view.generation_id, generation);
  assert.equal(f.metrics().interruptions, 0);
  assert.equal(f.continuations.length, 0);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我还验证了命中率。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.continuations.length === 1);
  assert.equal(f.continuations[0], '我还验证了命中率。');
});

test('a delayed final supplement keeps publication reserved until the same answer can be updated', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  f.activities.length = 0;
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '还测了命中率', final: false });
  f.session.control({ type: 'speech_end' });
  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal(f.activities.at(-1)?.active, true);
  assert.equal(f.fixture.view.generation_status, 'pending');
  f.recognize({ text: '还测了命中率。', final: true });
  await waitFor(() => f.continuations.length === 1);
  assert.ok(f.activities.some((a) => !a.active));
});

test('explicit completion without speech does not flush ASR or wait for a final packet', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'commit' });
  await waitFor(() => f.events.some((e) => e.type === 'status' && e.state === 'listening'));
  assert.equal(f.metrics().finishes, 0);
  assert.equal(f.answers.length, 0);
});

test('recognition final timeout releases the pending generation and preserves the transcript', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '我使用缓存。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.answers.length === 1);
  f.activities.length = 0;
  const generation = f.fixture.view.generation_id;
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '尚未确认的补充', final: false });
  f.session.control({ type: 'speech_end' });
  await waitFor(
    () => f.events.some((e) => e.type === 'error' && e.code === 'voice_final_pending'),
    10000,
  );
  await waitFor(() => f.activities.at(-1)?.active === false);
  assert.equal(f.fixture.view.generation_id, generation);
  assert.equal(f.continuations.length, 0);
  assert.ok(f.events.some((e) => e.type === 'transcript' && e.text === '尚未确认的补充'));
  assert.equal(f.disconnected(), false);
});

test('a failed next-question generation is reported without closing voice or losing the answer', async (t) => {
  const f = create();
  t.after(() => f.session.close());
  await startListening(f);
  const v = f.fixture.view;
  v.generation_status = 'failed';
  v.version++;
  v.turns[0].answer_status = 'answered';
  v.turns[0].answer_text = '已经保存';
  f.fixture.setView(v);
  await waitFor(() =>
    f.events.some((e) => e.type === 'error' && e.code === 'voice_generation_failed'),
  );
  assert.equal(f.disconnected(), false);
  assert.equal(f.fixture.view.turns[0].answer_text, '已经保存');
  f.session.control({ type: 'speech_start' });
  f.recognize({ text: '继续补充一次。', final: true });
  f.session.control({ type: 'speech_end' });
  await waitFor(() => f.continuations.length === 1);
  assert.equal(f.fixture.view.generation_status, 'pending');
});
