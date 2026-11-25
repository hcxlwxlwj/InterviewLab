import { useRef } from 'react';
import type { InterviewConfig } from '@interviewlab/core';
import type { useInterviewVoice } from './voice/use-voice';
import {
  prepareVoiceDevices,
  releaseVoiceDevices,
  type PreparedVoiceDevices,
} from './voice/devices';

interface DeviceOptions {
  current: { current: { textMode: boolean; camera: MediaStream | null } };
  epoch: { current: number };
  alive: { current: boolean };
  voice: { current: Pick<ReturnType<typeof useInterviewVoice>, 'stop'> };
  update: (patch: { camera?: MediaStream | null; deviceReady?: boolean }) => void;
}

/** Own prepared devices and release late permission results after an entry is cancelled. */
export function usePreparedInterviewDevices(options: DeviceOptions) {
  const devices = useRef<PreparedVoiceDevices | null>(null);
  const pending = useRef<Promise<PreparedVoiceDevices> | null>(null);

  function clearDevices() {
    options.voice.current.stop();
    options.current.current.camera?.getTracks().forEach((track) => track.stop());
    if (devices.current) releaseVoiceDevices(devices.current);
    devices.current = null;
    pending.current = null;
    options.update({ camera: null, deviceReady: false });
  }

  function prepareDevices(config: InterviewConfig): Promise<PreparedVoiceDevices | null> {
    if (config.interaction_mode === 'text_fallback' || options.current.current.textMode) {
      options.update({ deviceReady: true });
      return Promise.resolve(null);
    }
    if (
      devices.current?.context.state !== 'closed' &&
      devices.current?.media.getAudioTracks().some((track) => track.readyState !== 'ended')
    )
      return Promise.resolve(devices.current);
    if (pending.current) return pending.current;

    const generation = options.epoch.current;
    // Resume remains in the original submit/retry gesture, before any network wait.
    const work = prepareVoiceDevices(config.interaction_mode === 'realtime_video').then(
      (result) => {
        if (generation !== options.epoch.current || !options.alive.current) {
          releaseVoiceDevices(result);
          throw new Error('本次准备已取消。');
        }
        result.camera?.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
        devices.current = result;
        options.update({ camera: result.camera });
        return result;
      },
    );
    pending.current = work;
    void work.catch(() => {
      if (pending.current === work) pending.current = null;
    });
    return work;
  }
  return { devices, clearDevices, prepareDevices };
}
