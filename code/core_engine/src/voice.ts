import type { Interview } from './live-interview';

export interface VoiceCapabilities {
  available: boolean;
  reason: string | null;
  input_sample_rate: 16000;
  output_sample_rate: 24000;
  silence_ms: number;
}
export type VoiceClientEvent =
  | { type: 'speech_start' }
  | { type: 'speech_end' }
  | { type: 'commit' }
  | { type: 'hold'; enabled: boolean }
  | { type: 'interrupt' }
  | { type: 'repeat' }
  | { type: 'playback'; speech_id: string; played_ms: number; interrupted: boolean }
  | { type: 'ping' };
export type VoiceServerEvent =
  | { type: 'ready'; silence_ms: number }
  | { type: 'transcript'; text: string; final: boolean; turn_id: string | null }
  | { type: 'submitting'; text: string; turn_id: string }
  | { type: 'interview'; interview: Interview }
  | { type: 'speech_start'; speech_id: string; turn_id: string; text: string }
  | { type: 'audio'; speech_id: string; pcm: string }
  | { type: 'speech_end'; speech_id: string }
  | { type: 'interrupted'; speech_id: string | null }
  | { type: 'status'; state: 'listening' | 'thinking' | 'paused' | 'closed' }
  | { type: 'error'; code: string; message: string; retryable: boolean };
