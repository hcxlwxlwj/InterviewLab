/* Runs off the main thread. PCM16 mono, 16 kHz, 200 ms packets. No audio is stored. */
class InterviewVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.position = 0;
    this.packet = new Int16Array(3200);
    this.offset = 0;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.talking = false;
  }
  process(inputs, outputs) {
    for (const channels of outputs) for (const channel of channels) channel.fill(0);
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let power = 0;
    for (const value of channel) {
      this.samples.push(value);
      power += value * value;
    }
    const rms = Math.sqrt(power / channel.length);
    const ms = (channel.length * 1000) / sampleRate;
    if (rms > 0.018) {
      this.speechMs += ms;
      this.silenceMs = 0;
    } else {
      this.silenceMs += ms;
      if (!this.talking) this.speechMs = 0;
    }
    if (!this.talking && this.speechMs >= 160) {
      this.talking = true;
      this.port.postMessage({ type: 'speech_start' });
    }
    if (this.talking && this.silenceMs >= 500) {
      this.talking = false;
      this.speechMs = 0;
      this.port.postMessage({ type: 'speech_end' });
    }
    // Fractional position persists across render quanta, including 44.1 kHz devices.
    const step = sampleRate / 16000;
    while (this.position + 1 < this.samples.length) {
      const index = Math.floor(this.position),
        fraction = this.position - index;
      const value = this.samples[index] * (1 - fraction) + this.samples[index + 1] * fraction;
      const clamped = Math.max(-1, Math.min(1, value));
      this.packet[this.offset++] =
        clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
      this.position += step;
      if (this.offset === this.packet.length) {
        const pcm = new ArrayBuffer(this.packet.length * 2),
          view = new DataView(pcm);
        for (let i = 0; i < this.packet.length; i++) view.setInt16(i * 2, this.packet[i], true);
        this.port.postMessage({ type: 'audio', pcm }, [pcm]);
        this.offset = 0;
      }
    }
    const consumed = Math.floor(this.position);
    this.samples.splice(0, consumed);
    this.position -= consumed;
    return true;
  }
}
registerProcessor('interview-voice-capture', InterviewVoiceCapture);
