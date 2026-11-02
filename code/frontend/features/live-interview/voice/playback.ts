/** Schedules PCM incrementally, with an identity fence against late audio after interruption. */
export class VoicePlayback {
  private current?: {
    id: string;
    sources: Set<AudioBufferSourceNode>;
    segments: { start: number; duration: number; levels: number[] }[];
    sealed: boolean;
  };
  private nextTime = 0;
  constructor(
    private readonly context: AudioContext,
    private readonly receipt: (id: string, playedMs: number, interrupted: boolean) => void,
    private readonly state: (playing: boolean) => void,
  ) {}
  start(id: string) {
    this.stop(true);
    this.current = { id, sources: new Set(), segments: [], sealed: false };
    this.nextTime = this.context.currentTime + 0.03;
    this.state(true);
  }
  append(id: string, base64: string) {
    const clip = this.current;
    if (!clip || clip.id !== id || clip.sealed) return;
    const binary = atob(base64);
    if (binary.length % 2 || binary.length > 1024 * 1024) throw new Error('Invalid PCM');
    const pcm = new DataView(Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer);
    if (!binary.length) return;
    const audio = this.context.createBuffer(1, binary.length / 2, 24000);
    const channel = audio.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = pcm.getInt16(i * 2, true) / 32768;
    const start = Math.max(this.context.currentTime + 0.015, this.nextTime);
    if (start - this.context.currentTime > 60) throw new Error('Audio backlog');
    const source = this.context.createBufferSource();
    source.buffer = audio;
    source.connect(this.context.destination);
    clip.sources.add(source);
    const levels: number[] = [];
    for (let offset = 0; offset < channel.length; offset += 480) {
      const end = Math.min(channel.length, offset + 480);
      let power = 0;
      for (let i = offset; i < end; i++) power += channel[i] ** 2;
      levels.push(Math.min(1, Math.sqrt(power / (end - offset)) * 5));
    }
    clip.segments.push({ start, duration: audio.duration, levels });
    source.onended = () => {
      source.disconnect();
      clip.sources.delete(source);
      if (this.current === clip && clip.sealed && clip.sources.size === 0) this.stop(false);
    };
    source.start(start);
    this.nextTime = start + audio.duration;
  }
  /** Read the currently audible envelope, not queued/network audio. */
  getLevel() {
    const now = this.context.currentTime;
    const segment = this.current?.segments.find(
      (s) => now >= s.start && now < s.start + s.duration,
    );
    return segment?.levels[Math.floor((now - segment.start) / 0.02)] ?? 0;
  }
  finish(id: string) {
    if (this.current?.id !== id) return;
    this.current.sealed = true;
    if (!this.current.sources.size) this.stop(false);
  }
  interrupt(id: string | null) {
    if (id === null || this.current?.id === id) this.stop(true);
  }
  stop(interrupted = true) {
    const clip = this.current;
    this.current = undefined;
    if (!clip) return;
    const playedMs = clip.segments.reduce(
      (sum, segment) =>
        sum +
        Math.max(0, Math.min(segment.duration, this.context.currentTime - segment.start)) * 1000,
      0,
    );
    for (const source of clip.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.state(false);
    this.receipt(clip.id, Math.round(playedMs), interrupted);
  }
}
