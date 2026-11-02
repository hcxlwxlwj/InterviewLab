import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import WebSocket from 'ws';
import type { BackendConfig } from '../../../foundation/config';
import { ServiceError } from '../../../foundation/errors';

export interface Recognition {
  text: string;
  final: boolean;
}
export interface AsrStream {
  write(pcm: Uint8Array): void;
  finish(): void;
  close(): void;
}
export interface VoiceProvider {
  readonly available: boolean;
  recognize(onText: (result: Recognition) => void, onError: () => void): Promise<AsrStream>;
  speak(text: string, signal: AbortSignal, onAudio: (pcm: Uint8Array) => void): Promise<void>;
}
const MAX_FRAME = 2 * 1024 * 1024;
const failure = () =>
  new ServiceError(
    'voice_provider_failed',
    502,
    '语音服务连接失败，请检查语音服务配置或切回文字。',
    true,
  );
const size = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
export function asrPacket(payload: Uint8Array, audio = false, last = false) {
  const data = gzipSync(payload);
  return Buffer.concat([
    Buffer.from([0x11, audio ? (last ? 0x22 : 0x20) : 0x10, audio ? 0x01 : 0x11, 0]),
    size(data.length),
    data,
  ]);
}
/** Both ASR and unidirectional TTS use the v3 binary framing; never surface raw errors. */
export function decodeVoicePacket(data: Buffer): {
  event: number;
  last: boolean;
  payload: Buffer;
  json: unknown;
} {
  if (data.length < 8 || data.length > MAX_FRAME || data[0] >> 4 !== 1) throw failure();
  const kind = data[1] >> 4,
    flags = data[1] & 15;
  let offset = (data[0] & 15) * 4;
  let event = 0;
  if (offset < 4 || offset > data.length - 4 || kind === 15) throw failure();
  if (flags & 1) offset += 4;
  if (flags & 4) {
    event = data.readInt32BE(offset);
    offset += 4;
    const idLength = data.readUInt32BE(offset);
    offset += 4 + idLength;
  }
  if (offset > data.length - 4) throw failure();
  const length = data.readUInt32BE(offset);
  offset += 4;
  if (length > MAX_FRAME || offset + length !== data.length) throw failure();
  let payload = data.subarray(offset);
  if ((data[2] & 15) === 1) payload = gunzipSync(payload, { maxOutputLength: MAX_FRAME });
  else if ((data[2] & 15) !== 0) throw failure();
  const json = data[2] >> 4 === 1 ? JSON.parse(payload.toString('utf8')) : null;
  return { event, last: Boolean(flags & 2), payload, json };
}
function connect(url: string, key: string, resource: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {
      handshakeTimeout: 10000,
      maxPayload: MAX_FRAME,
      headers: {
        'X-Api-Key': key,
        'X-Api-Resource-Id': resource,
        'X-Api-Request-Id': randomUUID(),
        'X-Api-Connect-Id': randomUUID(),
      },
    });
    const fail = () => {
      socket.terminate();
      reject(failure());
    };
    socket.once('error', fail);
    socket.once('unexpected-response', fail);
    socket.once('open', () => {
      socket.removeListener('error', fail);
      socket.on('error', () => {});
      resolve(socket);
    });
  });
}
export function createVolcengineVoice(config: BackendConfig): VoiceProvider {
  return {
    available: Boolean(config.VOICE_ENABLED && config.VOLC_ASR_API_KEY && config.VOLC_TTS_API_KEY),
    async recognize(onText, onError) {
      const socket = await connect(
        'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async',
        config.VOLC_ASR_API_KEY!,
        config.VOLC_ASR_RESOURCE_ID,
      );
      let closed = false,
        finishing = false;
      const fail = () => {
        if (!closed) {
          closed = true;
          socket.terminate();
          onError();
        }
      };
      socket.on('message', (raw) => {
        if (closed) return;
        try {
          const message = decodeVoicePacket(Buffer.from(raw as Buffer));
          const result = message.json as {
            code?: number;
            result?: { text?: string; utterances?: { definite?: boolean }[] };
          };
          if (result?.code && result.code !== 20000000 && result.code !== 1000) throw failure();
          if (typeof result?.result?.text === 'string') {
            const utterances = result.result.utterances;
            onText({
              text: result.result.text,
              final: message.last || Boolean(utterances?.length && utterances.at(-1)?.definite),
            });
          }
          if (message.last) {
            closed = true;
            socket.close();
          }
        } catch {
          fail();
        }
      });
      socket.on('error', fail);
      socket.on('close', () => {
        if (!closed && !finishing) fail();
      });
      socket.send(
        asrPacket(
          Buffer.from(
            JSON.stringify({
              user: { uid: randomUUID() },
              audio: { format: 'pcm', codec: 'raw', rate: 16000, bits: 16, channel: 1 },
              request: {
                model_name: 'bigmodel',
                enable_itn: true,
                enable_punc: true,
                enable_ddc: false,
                enable_nonstream: true,
                show_utterances: true,
                result_type: 'full',
                end_window_size: 800,
              },
            }),
          ),
        ),
      );
      return {
        write(pcm) {
          if (!closed && !finishing && socket.readyState === WebSocket.OPEN) {
            if (socket.bufferedAmount > 128000) {
              fail();
              return;
            }
            socket.send(asrPacket(pcm, true));
          }
        },
        finish() {
          if (!closed && !finishing) {
            finishing = true;
            socket.send(asrPacket(new Uint8Array(), true, true));
          }
        },
        close() {
          closed = true;
          socket.terminate();
        },
      };
    },
    async speak(text, signal, onAudio) {
      if (signal.aborted) return;
      const socket = await connect(
        'wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream',
        config.VOLC_TTS_API_KEY!,
        config.VOLC_TTS_RESOURCE_ID,
      );
      if (signal.aborted) {
        socket.terminate();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const end = (error = false) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          signal.removeEventListener('abort', abort);
          socket.terminate();
          if (error) reject(failure());
          else resolve();
        };
        const abort = () => end();
        const timeout = setTimeout(() => end(true), 45000);
        signal.addEventListener('abort', abort, { once: true });
        socket.on('message', (raw) => {
          if (done || signal.aborted) return;
          try {
            const message = decodeVoicePacket(Buffer.from(raw as Buffer));
            if (message.event === 352) {
              if (message.payload.length % 2) throw failure();
              onAudio(message.payload);
            }
            if (message.event === 153) throw failure();
            if (message.event === 152) {
              const meta = message.json as { status_code?: number } | null;
              end(Boolean(meta?.status_code && meta.status_code !== 20000000));
            }
          } catch {
            end(true);
          }
        });
        socket.on('error', () => end(true));
        socket.on('close', () => end(!signal.aborted));
        const payload = Buffer.from(
          JSON.stringify({
            user: { uid: randomUUID() },
            req_params: {
              text,
              speaker: config.VOLC_TTS_SPEAKER,
              audio_params: { format: 'pcm', sample_rate: 24000 },
            },
          }),
        );
        socket.send(
          Buffer.concat([Buffer.from([0x11, 0x10, 0x10, 0]), size(payload.length), payload]),
        );
      });
    },
  };
}
