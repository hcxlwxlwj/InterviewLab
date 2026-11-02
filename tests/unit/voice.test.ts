import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  asrPacket,
  decodeVoicePacket,
} from '../../code/backend/src/modules/interviews/voice/volcengine';
import { VoicePlayback } from '../../code/frontend/features/live-interview/voice/playback';

const size = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
test('Volcengine binary framing decodes gzipped ASR and PCM TTS, rejects malformed and error packets', () => {
  const payload = Buffer.from(JSON.stringify({ result: { text: '测试回答' } }));
  const frame = asrPacket(payload);
  assert.equal(frame[1], 0x10);
  assert.deepEqual(gunzipSync(frame.subarray(8)), payload);
  assert.equal(asrPacket(Buffer.from([0, 1]), true, true)[1], 0x22);
  const compressed = gzipSync(payload);
  const recognition = Buffer.concat([
    Buffer.from([0x11, 0x93, 0x11, 0]),
    Buffer.from([255, 255, 255, 255]),
    size(compressed.length),
    compressed,
  ]);
  const decoded = decodeVoicePacket(recognition);
  assert.equal(decoded.last, true);
  assert.deepEqual(decoded.json, JSON.parse(payload.toString()));
  const audio = Buffer.from([1, 0, 2, 0]);
  const tts = Buffer.concat([
    Buffer.from([0x11, 0xb4, 0, 0]),
    size(352),
    size(3),
    Buffer.from('sid'),
    size(audio.length),
    audio,
  ]);
  assert.equal(decodeVoicePacket(tts).event, 352);
  assert.deepEqual(decodeVoicePacket(tts).payload, audio);
  for (const bad of [
    Buffer.alloc(2),
    Buffer.from([0x11, 0xf0, 0, 0, 0, 0, 0, 0]),
    recognition.subarray(0, recognition.length - 1),
    Buffer.concat([recognition, Buffer.from([0])]),
  ])
    assert.throws(() => decodeVoicePacket(bad));
});

test('PCM playback stops queued sources immediately and ignores stale generations and stale cancellation', () => {
  const sources: {
    stopped: boolean;
    onended: (() => void) | null;
    start: (n: number) => void;
    stop: () => void;
    disconnect: () => void;
  }[] = [];
  const context = {
    currentTime: 0,
    destination: {},
    createBuffer: (_: number, count: number, rate: number) => ({
      duration: count / rate,
      getChannelData: () => new Float32Array(count),
    }),
    createBufferSource: () => {
      const source = {
        stopped: false,
        onended: null,
        start: () => {},
        stop() {
          this.stopped = true;
        },
        disconnect() {},
        connect() {},
      };
      sources.push(source);
      return source;
    },
  };
  const receipts: unknown[] = [];
  const playback = new VoicePlayback(
    context as unknown as AudioContext,
    (...args) => receipts.push(args),
    () => {},
  );
  const pcm = Buffer.alloc(4800).toString('base64');
  playback.start('first');
  playback.append('first', pcm);
  playback.append('first', pcm);
  context.currentTime = 0.08;
  playback.stop(true);
  assert.ok(sources.every((source) => source.stopped));
  assert.deepEqual(receipts[0], ['first', 50, true]);
  playback.start('second');
  playback.append('first', pcm);
  playback.interrupt('first');
  assert.equal(sources.length, 2);
  playback.append('second', pcm);
  assert.equal(sources.length, 3);
  playback.finish('first');
  playback.finish('second');
  context.currentTime = 1;
  sources[2].onended?.();
  assert.deepEqual(receipts[1], ['second', 100, false]);
});

test('capture worklet resamples common device rates to 16kHz and emits VAD start/end without recording files', () => {
  for (const sampleRate of [16000, 44100, 48000]) {
    let Processor: new () => {
      process(input: Float32Array[][], output: Float32Array[][]): boolean;
    };
    const messages: { type: string; pcm?: ArrayBuffer }[] = [];
    runInNewContext(readFileSync('code/frontend/public/voice-capture.worklet.js', 'utf8'), {
      sampleRate,
      AudioWorkletProcessor: class {
        port = { postMessage: (data: { type: string; pcm?: ArrayBuffer }) => messages.push(data) };
      },
      registerProcessor: (_name: string, value: typeof Processor) => {
        Processor = value;
      },
    });
    const capture = new Processor!();
    const blocks = Math.ceil((sampleRate * 2) / 128);
    for (let i = 0; i < blocks; i++)
      capture.process(
        [[new Float32Array(128).fill(i < blocks / 2 ? 0.1 : 0)]],
        [[new Float32Array(128)]],
      );
    assert.equal(messages.filter((m) => m.type === 'speech_start').length, 1);
    assert.equal(messages.filter((m) => m.type === 'speech_end').length, 1);
    const packets = messages.filter((m) => m.type === 'audio');
    assert.ok(packets.length >= 9 && packets.length <= 10);
    assert.ok(packets.every((m) => m.pcm?.byteLength === 6400));
  }
});
