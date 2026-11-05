import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeVoiceClient } from '../../code/frontend/features/live-interview/voice/client';
import type { VoiceServerEvent } from '@interviewlab/core';

function browserFixture(options: { denyPermission?: boolean } = {}) {
  const keys = ['window', 'navigator', 'AudioContext', 'AudioWorkletNode', 'WebSocket'] as const;
  const saved = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const events: VoiceServerEvent[] = [],
    sent: unknown[] = [];
  const playing: boolean[] = [];
  const sources: { onended: (() => void) | null }[] = [];
  let constraints: MediaStreamConstraints | undefined;
  let resumes = 0,
    stopped = false,
    disconnected = false;
  let capture!: Worklet, socket!: Socket, context!: Context;
  const track = {
    label: 'USB 测试麦克风',
    enabled: true,
    addEventListener() {},
    stop() {
      stopped = true;
    },
  };
  class Context {
    state = 'suspended';
    destination = {};
    currentTime = 0;
    onstatechange: (() => void) | null = null;
    audioWorklet = { async addModule() {} };
    constructor() {
      context = this;
    }
    async resume() {
      resumes++;
      this.state = 'running';
    }
    async close() {
      this.state = 'closed';
      this.onstatechange?.();
    }
    createBuffer(_channels: number, length: number, rate: number) {
      return { duration: length / rate, getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      const source = {
        buffer: null,
        onended: null as (() => void) | null,
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
      sources.push(source);
      return source;
    }
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
  }
  class Worklet {
    port = { postMessage() {}, onmessage: null as ((event: { data: unknown }) => void) | null };
    onprocessorerror: (() => void) | null = null;
    constructor() {
      capture = this;
    }
    connect() {}
    disconnect() {}
  }
  class Socket {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      socket = this;
    }
    send(data: unknown) {
      sent.push(data);
    }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  const replacements = {
    window: {
      isSecureContext: true,
      AudioWorkletNode: Worklet,
      location: { origin: 'http://127.0.0.1:3000' },
    },
    navigator: {
      mediaDevices: {
        async getUserMedia(input: MediaStreamConstraints) {
          constraints = input;
          if (options.denyPermission) throw new DOMException('Denied', 'NotAllowedError');
          context.state = 'suspended';
          return { getAudioTracks: () => [track], getTracks: () => [track] };
        },
      },
    },
    AudioContext: Context,
    AudioWorkletNode: Worklet,
    WebSocket: Socket,
  };
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: replacements[key],
    });
  const client = new RealtimeVoiceClient(
    'synthetic',
    (event) => events.push(event),
    (value) => playing.push(value),
    () => {
      disconnected = true;
    },
    () => {},
  );
  return {
    client,
    track,
    hasSocket: () => Boolean(socket),
    playing,
    sources,
    server(event: VoiceServerEvent) {
      socket.onmessage?.({ data: JSON.stringify(event) });
    },
    vad(type: 'speech_start' | 'speech_end') {
      capture.port.onmessage?.({ data: { type } });
    },
    events,
    sent,
    ready() {
      socket.onmessage?.({ data: JSON.stringify({ type: 'ready', silence_ms: 3000 }) });
    },
    audio(amplitude: number) {
      const pcm = new ArrayBuffer(6400),
        view = new DataView(pcm);
      for (let i = 0; i < 6400; i += 2) view.setInt16(i, Math.round(amplitude * 32767), true);
      capture.port.onmessage?.({ data: { type: 'audio', pcm } });
    },
    processorError() {
      capture.onprocessorerror?.();
    },
    get constraints() {
      return constraints;
    },
    get resumes() {
      return resumes;
    },
    get stopped() {
      return stopped;
    },
    get disconnected() {
      return disconnected;
    },
    restore() {
      client.stop();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('voice uses the browser microphone, resumes after permission and waits for capture before reporting ready', async () => {
  const f = browserFixture();
  try {
    await f.client.start();
    assert.equal((f.constraints!.audio as MediaTrackConstraints).deviceId, undefined);
    assert.equal(f.resumes, 2);
    f.ready();
    assert.ok(!f.events.some((e) => e.type === 'ready'));
    f.audio(0.1);
    assert.equal(f.events.filter((e) => e.type === 'ready').length, 1);
    assert.ok(f.sent.some((data) => data instanceof ArrayBuffer));
    f.client.setMuted(true);
    f.audio(0.1);
    assert.ok(new Uint8Array(f.sent.at(-1) as ArrayBuffer).every((value) => value === 0));
  } finally {
    f.restore();
  }
});

test('silence remains a valid live capture while a processor error explicitly closes the microphone', async () => {
  const f = browserFixture();
  try {
    await f.client.start();
    f.ready();
    f.audio(0);
    assert.ok(f.events.some((e) => e.type === 'ready'));
    assert.ok(f.sent.some((data) => data instanceof ArrayBuffer));
    assert.ok(!f.events.some((e) => e.type === 'error'));
    f.processorError();
    assert.ok(f.events.some((e) => e.type === 'error' && /音频处理失败/.test(e.message)));
    assert.equal(f.stopped, true);
    assert.equal(f.disconnected, true);
  } finally {
    f.restore();
  }
});

test('a connected socket with no capture frames times out instead of pretending to listen', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = browserFixture();
  try {
    await f.client.start();
    f.ready();
    t.mock.timers.tick(5001);
    assert.ok(!f.events.some((e) => e.type === 'ready'));
    assert.ok(f.events.some((e) => e.type === 'error' && /没有产生麦克风音频/.test(e.message)));
    assert.equal(f.stopped, true);
    assert.equal(f.disconnected, true);
  } finally {
    f.restore();
    t.mock.timers.reset();
  }
});

test('interviewer playback mutes capture through local audio completion and restores it after the echo tail', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = browserFixture();
  try {
    await f.client.start();
    f.ready();
    f.audio(0);
    f.server({ type: 'speech_start', speech_id: 's1', turn_id: 't1', text: '问题' });
    assert.equal(f.track.enabled, false);
    f.audio(0.5);
    f.vad('speech_start');
    assert.ok(new Uint8Array(f.sent.at(-1) as ArrayBuffer).every((v) => v === 0));
    assert.ok(!f.sent.some((v) => typeof v === 'string' && JSON.parse(v).type === 'speech_start'));
    f.server({ type: 'audio', speech_id: 's1', pcm: 'AAA=' });
    f.server({ type: 'speech_end', speech_id: 's1' });
    t.mock.timers.tick(1000);
    assert.equal(f.track.enabled, false, 'network completion must not unmute queued audio');
    f.sources[0].onended?.();
    t.mock.timers.tick(299);
    assert.equal(f.track.enabled, false);
    t.mock.timers.tick(1);
    assert.equal(f.track.enabled, true);
    f.audio(0.5);
    assert.ok(new Uint8Array(f.sent.at(-1) as ArrayBuffer).some((v) => v !== 0));
    // New output supersedes an old cooldown; explicit mute survives automatic resume.
    f.server({ type: 'speech_start', speech_id: 's2', turn_id: 't1', text: '重复' });
    f.client.setMuted(true);
    f.server({ type: 'speech_end', speech_id: 's2' });
    f.server({ type: 'speech_start', speech_id: 's3', turn_id: 't1', text: '新问题' });
    t.mock.timers.tick(1000);
    assert.equal(f.track.enabled, false);
    f.client.setMuted(false);
    assert.equal(f.track.enabled, false);
    f.client.setMuted(true);
    f.server({ type: 'speech_end', speech_id: 's3' });
    t.mock.timers.tick(300);
    assert.equal(f.track.enabled, false);
    f.client.setMuted(false);
    assert.equal(f.track.enabled, true);
  } finally {
    f.restore();
    t.mock.timers.reset();
  }
});

test('one-click voice start obtains microphone permission before starting the interview and opens the socket afterwards', async () => {
  const f = browserFixture();
  let starts = 0;
  try {
    await f.client.start(async () => {
      assert.ok(f.constraints?.audio, 'permission must be requested first');
      assert.equal(f.hasSocket(), false, 'socket must wait for the interview start response');
      starts++;
    });
    assert.equal(starts, 1);
    assert.equal(f.hasSocket(), true);
  } finally {
    f.restore();
  }
});

test('denied microphone permission does not start the interview or open a voice socket', async () => {
  const f = browserFixture({ denyPermission: true });
  let starts = 0;
  try {
    await assert.rejects(
      f.client.start(async () => {
        starts++;
      }),
      /未获得麦克风权限/,
    );
    assert.equal(starts, 0);
    assert.equal(f.hasSocket(), false);
  } finally {
    f.restore();
  }
});

test('failed interview start releases the acquired microphone and never opens a premature socket', async () => {
  const f = browserFixture();
  try {
    await assert.rejects(
      f.client.start(async () => {
        throw new Error('面试尚未准备好');
      }),
      /面试尚未准备好/,
    );
    assert.equal(f.stopped, true);
    assert.equal(f.hasSocket(), false);
  } finally {
    f.restore();
  }
});
