'use client';
import Link from 'next/link';
import { ArrowRight, CameraOff, Check, Keyboard, MicOff } from 'lucide-react';
import { Choices, InterviewSetupPage } from '../../components/interview-setup';
import { Button } from '../../components/ui/button';
import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LIVE_TYPE_LABELS, type InterviewConfig } from '@interviewlab/core';
import { interviewsApi } from '../../lib/api/interviews';
import { Loading } from '../../components/shared';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';

function Form() {
  const router = useRouter();
  const search = useSearchParams();
  const [config, setConfig] = useState<InterviewConfig>({
    job: search.get('job') ?? 'frontend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    difficulty: '基础',
    duration_minutes: 10,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  const load = useCallback((signal: AbortSignal) => interviewsApi.jobs(signal), []);
  const jobs = useLiveResource(load, () => false);
  const loadProfiles = useCallback(
    (signal: AbortSignal) => interviewsApi.profiles(config.job, config.career_stage, signal),
    [config.job, config.career_stage],
  );
  const profiles = useLiveResource(loadProfiles, () => false);
  const command = useLiveCommand();
  const change = <K extends keyof InterviewConfig>(key: K, value: InterviewConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  if (!jobs.value)
    return (
      <>
        <ErrorNotice message={jobs.error} retry={() => void jobs.refresh()} />
        {!jobs.error && <Loading />}
      </>
    );
  const selected = jobs.value.items.find((j) => j.id === config.job);
  return (
    <form
      className="setup-grid"
      onSubmit={(e) => {
        e.preventDefault();
        command.run(
          (key) => interviewsApi.create(config, key),
          (result) => router.push(`/interview/${result.id}`),
        );
      }}
    >
      <div className="setup-panels">
        <section className="panel form-panel">
          <div className="form-panel-title">
            <span className="section-number">01</span>
            <div>
              <h2>面试方向</h2>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="job-direction">
              岗位方向
            </label>
            <select
              id="job-direction"
              value={config.job}
              disabled={command.blocked}
              onChange={(e) =>
                setConfig((c) => ({ ...c, job: e.target.value, interview_type: 'technical_qa' }))
              }
            >
              <option value="" disabled>
                请选择岗位
              </option>
              {jobs.value.items.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
            <Link href="/jobs" className="text-link">
              查看岗位职责与考查主题 →
            </Link>
          </div>
          {!selected && (
            <p className="error-inline" role="alert">
              所选岗位不可用，请重新选择。
            </p>
          )}
          <Choices
            label="准备阶段"
            name="career-stage"
            value={config.career_stage}
            options={[
              { value: 'internship', label: '实习' },
              { value: 'campus', label: '校招' },
            ]}
            onChange={(v) => change('career_stage', v)}
            disabled={command.blocked}
          />
          <ErrorNotice message={profiles.error} retry={() => void profiles.refresh()} />
          <Choices
            label="面试类型"
            name="interview-type"
            value={config.interview_type}
            options={(profiles.value?.profiles ?? []).map((p) => ({
              value: p.type,
              label: p.label,
            }))}
            onChange={(v) => change('interview_type', v)}
            disabled={command.blocked}
          />
          <Choices
            label="面试难度"
            name="difficulty"
            value={config.difficulty}
            options={[{ value: '基础', label: '基础' }]}
            onChange={(v) => change('difficulty', v)}
            disabled={command.blocked}
          />
        </section>
        <section className="panel form-panel">
          <div className="form-panel-title">
            <span className="section-number">02</span>
            <div>
              <h2>面试设置</h2>
            </div>
          </div>
          <Choices
            label="目标时长"
            name="duration"
            value={config.duration_minutes}
            options={[
              { value: 5, label: '5 分钟' },
              { value: 10, label: '10 分钟' },
            ]}
            onChange={(v) => change('duration_minutes', v)}
            disabled={command.blocked}
          />
          <Choices
            label="面试官风格"
            name="style"
            value={config.interviewer_style}
            options={(['标准', '友好', '深入追问'] as const).map((value) => ({
              value,
              label: value,
            }))}
            onChange={(v) => change('interviewer_style', v)}
            disabled={command.blocked}
          />
          <p className="field-help">
            最多 6 个主问题，每题最多 2 次追问。达到目标时间后收尾，12
            分钟自动结束；暂停和断线仍计时。
          </p>
        </section>
        <section className="panel form-panel">
          <div className="form-panel-title">
            <span className="section-number">03</span>
            <div>
              <h2>简历与重点经历</h2>
            </div>
          </div>
          <p className="field-help">
            本轮从自我介绍了解你的背景，不读取简历或个人 JD。项目交流依据你在面试中提供的信息展开。
          </p>
        </section>
        <section className="panel form-panel">
          <div className="form-panel-title">
            <span className="section-number">04</span>
            <div>
              <h2>作答方式</h2>
            </div>
          </div>
          <Choices
            label="交互方式"
            name="interaction-mode"
            value={config.interaction_mode}
            options={[{ value: 'text_fallback', label: '文字作答' }]}
            onChange={(v) => change('interaction_mode', v)}
            disabled={command.blocked}
          />
          <div className="privacy-checks">
            <span>
              <MicOff size={14} />
              麦克风未采集
            </span>
            <span>
              <CameraOff size={14} />
              摄像头关闭
            </span>
            <span>
              <Check size={14} />
              不保存音视频
            </span>
          </div>
        </section>
      </div>
      <aside className="panel setup-summary">
        <h2>这一次，练习什么</h2>
        <div className="summary-rows">
          <div className="summary-row">
            <span>目标岗位</span>
            <strong>{selected?.title ?? '请选择岗位'}</strong>
          </div>
          <div className="summary-row">
            <span>面试类型</span>
            <strong>{LIVE_TYPE_LABELS[config.interview_type]}</strong>
          </div>
          <div className="summary-row">
            <span>难度 / 时长</span>
            <strong>
              {config.difficulty} · {config.duration_minutes} 分钟
            </strong>
          </div>
          <div className="summary-row">
            <span>面试官风格</span>
            <strong>{config.interviewer_style}</strong>
          </div>
          <div className="summary-row">
            <span>面试开场</span>
            <strong>自我介绍</strong>
          </div>
          <div className="summary-row">
            <span>实际作答</span>
            <strong>
              <Keyboard size={13} />
              文字作答
            </strong>
          </div>
        </div>
        <p className="notice">
          回答会发送至 AI 模型。请勿填写联系方式等敏感信息；面试官会根据你的陈述继续提问。
        </p>
        <p className="field-help">创建配置后，在面试页点击开始才计时。</p>
        <CommandNotice command={command} />
        <Button
          type="submit"
          disabled={command.blocked || !selected || !selected.stages.includes(config.career_stage)}
        >
          {command.busy ? '正在创建…' : '创建面试'}
          <ArrowRight size={17} />
        </Button>
      </aside>
    </form>
  );
}
export default function LiveSetup() {
  return (
    <InterviewSetupPage
      title="配置你的模拟面试"
      description="选择一个方向，从自我介绍开始，围绕你的经历自然交流。"
    >
      <SessionGate>
        <Form />
      </SessionGate>
    </InterviewSetupPage>
  );
}
