'use client';
import { JOBS } from '@interviewlab/backend/content';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { demoClient } from '../../lib/demo-client';

import type { LoadedWorkspace } from './use-workspace';
export function PreferencesSection({ workspace }: { workspace: LoadedWorkspace }) {
  const { state, setDeletion, act } = workspace;
  return (
    <section className="library-panel preference-library">
      <h2>新面试的默认设置</h2>
      <label>
        默认岗位方向
        <select
          value={state.preferences.default_job_direction}
          onChange={(e) =>
            act(
              () => demoClient.updatePreferences({ default_job_direction: e.target.value }),
              '偏好已保存，仅用于新的面试配置。',
            )
          }
        >
          <option value="">暂不指定</option>
          {JOBS.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        交互方式
        <select
          value={state.preferences.interaction_mode}
          onChange={(e) =>
            act(
              () =>
                demoClient.updatePreferences({
                  interaction_mode: e.target.value as 'text_fallback' | 'realtime_voice',
                }),
              '偏好已保存。',
            )
          }
        >
          <option value="text_fallback">文字作答</option>
          <option value="realtime_voice">语音流程预览（开始时切换文字）</option>
        </select>
      </label>
      <label>
        代码编辑器主题
        <select
          value={state.preferences.editor_theme}
          onChange={(e) =>
            act(
              () =>
                demoClient.updatePreferences({
                  editor_theme: e.target.value as 'system' | 'light' | 'dark',
                }),
              '偏好已保存。',
            )
          }
        >
          <option value="system">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>
      <hr />
      <h2>演示数据</h2>
      <p>关闭标签页后不保证保留。重置将移除新增简历、个人 JD、收藏和面试记录，恢复合成样例。</p>
      <Button variant="outline" onClick={() => setDeletion({ kind: 'reset', id: '' })}>
        <RotateCcw size={17} />
        重置演示
      </Button>
    </section>
  );
}
