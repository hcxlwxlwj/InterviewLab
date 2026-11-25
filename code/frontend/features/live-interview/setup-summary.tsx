import type { ReactNode } from 'react';
import { ArrowRight, Keyboard, Mic } from 'lucide-react';
import { LIVE_TYPE_LABELS } from '@interviewlab/core';
import { Button } from '../../components/ui/button';
import type { SetupConfiguration } from './setup-controller';

function SetupAnswerMode({ model }: { model: SetupConfiguration }) {
  const mode = model.config.interaction_mode;
  const label =
    mode === 'realtime_video' ? '视频面试' : mode === 'realtime_voice' ? '语音面试' : '文字作答';
  return (
    <>
      {mode !== 'text_fallback' ? <Mic size={13} /> : <Keyboard size={13} />}
      {label}
    </>
  );
}

function SetupSummaryRows({ model }: { model: SetupConfiguration }) {
  const { config, selected } = model;
  const rows: [string, ReactNode][] = [
    ['目标岗位', selected?.title ?? '请选择岗位'],
    ['面试类型', LIVE_TYPE_LABELS[config.interview_type]],
    [
      '难度 / 时长',
      <>
        {config.difficulty} · {config.duration_minutes} 分钟
      </>,
    ],
    ['面试官风格', config.interviewer_style],
    ['面试开场', '自我介绍'],
    ['实际作答', <SetupAnswerMode model={model} />],
  ];
  return (
    <div className="summary-rows">
      {rows.map(([label, value]) => (
        <div className="summary-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function SetupSummary({ model }: { model: SetupConfiguration }) {
  return (
    <aside className="panel setup-summary">
      <h2>这一次，练习什么</h2>
      <SetupSummaryRows model={model} />
      <p className="notice">
        回答会发送至 AI 模型。请勿填写联系方式等敏感信息；面试官会根据你的陈述继续提问。
      </p>
      <p className="field-help">准备和设备检查期间不计时，就绪后自动进入面试。</p>
      <Button type="submit" disabled={!model.canStart}>
        {model.busy ? '正在准备…' : '开启模拟面试'}
        <ArrowRight size={17} />
      </Button>
    </aside>
  );
}
