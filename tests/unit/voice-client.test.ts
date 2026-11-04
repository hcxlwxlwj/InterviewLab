import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeVoiceClient } from '../../code/frontend/features/live-interview/voice/client';
import type { VoiceServerEvent } from '@interviewlab/core';

function browserFixture() {
  const keys = ['window', 'navigator', 'AudioContext', 'AudioWorkletNode', 'WebSocket'] as const;
  const saved = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const events: VoiceServerEvent[] = [],
    sent: unknown[] = [];
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
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
  }
  class Worklet {
    port = { onmessage: null as ((event: { data: unknown }) => void) | null };
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
    () => {},
    () => {
      disconnected = true;
    },
    () => {},
  );
  return {
    client,
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
