import { loadEnvironment } from '../../code/backend/src/entrypoints/environment';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createVolcengineVoice } from '../../code/backend/src/modules/interviews/voice/volcengine';

// Uses only a fixed synthetic sentence. Keys, transcripts and audio never go to stdout or disk.
async function main() {
  loadEnvironment();
  const provider = createVolcengineVoice(loadConfig());
  if (!provider.available) {
    console.error('实时语音未配置：请在本机 .env 启用 VOICE_ENABLED，并填写 ASR/TTS Key。');
    process.exitCode = 1;
  } else {
    const signal = AbortSignal.timeout(30000);
    const audio: Uint8Array[] = [];
    const started = performance.now();
    let stream: Awaited<ReturnType<typeof provider.recognize>> | undefined;
    try {
      await provider.speak('你好，欢迎进入面试练习。请介绍一下你负责的项目。', signal, (chunk) =>
        audio.push(chunk),
      );
      const pcm24 = Buffer.concat(audio);
      if (!pcm24.length) throw new Error();
      const pcm16 = Buffer.alloc(Math.floor(((pcm24.length / 2) * 16000) / 24000) * 2);
      for (let i = 0; i < pcm16.length / 2; i++) {
        const position = i * 1.5,
          index = Math.floor(position),
          fraction = position - index;
        const a = pcm24.readInt16LE(index * 2),
          b = pcm24.readInt16LE(Math.min(index + 1, pcm24.length / 2 - 1) * 2);
        pcm16.writeInt16LE(Math.round(a * (1 - fraction) + b * fraction), i * 2);
      }
      let resolve!: () => void, reject!: (reason?: unknown) => void;
      const recognized = new Promise<void>((r, j) => {
        resolve = r;
        reject = j;
      });
      recognized.catch(() => {});
      const timeout = setTimeout(() => reject(new Error()), 25000);
      try {
        stream = await provider.recognize(
          (result) => {
            if (result.final && /面试|项目/.test(result.text)) resolve();
          },
          () => reject(new Error()),
        );
        for (let i = 0; i < pcm16.length; i += 6400) {
          stream.write(pcm16.subarray(i, i + 6400));
          await new Promise((r) => setTimeout(r, 200));
        }
        for (let i = 0; i < 5; i++) {
          stream.write(Buffer.alloc(6400));
          await new Promise((r) => setTimeout(r, 200));
        }
        stream.finish();
        await recognized;
      } finally {
        clearTimeout(timeout);
      }
      console.log(
        JSON.stringify({
          tts_audio: true,
          asr_recognized_test_sentence: true,
          elapsed_ms: Math.round(performance.now() - started),
        }),
      );
    } catch {
      console.error(
        '语音服务测试失败，详情已隐藏以保护凭证。请检查语音服务权限、资源 ID、音色和网络。',
      );
      process.exitCode = 1;
    } finally {
      stream?.close();
    }
  }
}
void main().catch(() => {
  console.error('语音配置检查失败，详情已隐藏以保护凭证，请检查本机配置格式。');
  process.exitCode = 1;
});
