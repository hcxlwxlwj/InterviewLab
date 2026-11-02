import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('voice:check runs from the CommonJS repository root, reports missing setup, and never prints credentials', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'tests/support/voice-provider-smoke.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        VOICE_ENABLED: 'false',
        VOLC_ASR_API_KEY: 'secret-sentinel-asr',
        VOLC_TTS_API_KEY: 'secret-sentinel-tts',
      },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.match(output, /实时语音未配置/);
  assert.doesNotMatch(output, /secret-sentinel|TransformError|top-level await/i);
});
