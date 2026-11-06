'use client';
import Link from 'next/link';
import { ArrowRight, CameraOff, Check, Keyboard, Mic, MicOff } from 'lucide-react';
import { Choices, InterviewSetupPage } from '../../components/interview-setup';
import { Button } from '../../components/ui/button';
import { apiRequest } from '../../lib/api/http';
import type { PersonalMaterial, PersonalSettings, JobTemplate } from '@interviewlab/core';
import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LIVE_TYPE_LABELS, mainQuestionLimit, type InterviewConfig } from '@interviewlab/core';
import { interviewsApi } from '../../lib/api/interviews';
import { jobsApi } from '../../lib/api/jobs';
import { Loading } from '../../components/shared';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';
import { selectInterviewJob } from './setup-state';
import { useInterviewFlow } from './flow-provider';
import { PreparationScreen } from './preparation';

function Form() {
  const search = useSearchParams();
  const requestedJob = search.get('job') ?? 'frontend';
  const load = useCallback(
    async (signal: AbortSignal) => {
      const page = await interviewsApi.jobs(signal);
      const initialJob =
        page.items.find((job) => job.id === requestedJob || job.slug === requestedJob) ??
        (await jobsApi.read(requestedJob, signal));
      if (!page.items.some((job) => job.id === initialJob.id)) page.items.unshift(initialJob);
      return { items: page.items, initialJob };
    },
    [requestedJob],
  );
  const jobs = useLiveResource(load, () => false);
  if (!jobs.value)
    return (
      <>
        <ErrorNotice message={jobs.error} retry={() => void jobs.refresh()} />
        {!jobs.error && <Loading />}
      </>
    );
  return <ConfigurationForm jobs={jobs.value.items} initialJob={jobs.value.initialJob} />;
}

function ConfigurationForm({ jobs, initialJob }: { jobs: JobTemplate[]; initialJob: JobTemplate }) {
  const flow = useInterviewFlow();
  const [config, setConfig] = useState<InterviewConfig>(
    () =>
      flow.configuration ??
      selectInterviewJob(
        {
          job: initialJob.id,
          career_stage: 'internship',
          interview_type: 'technical_qa',
          difficulty: '基础',
          duration_minutes: 10,
          interviewer_style: '标准',
          interaction_mode: 'text_fallback',
        },
        initialJob,
      ),
  );
  const [materials, setMaterials] = useState<PersonalMaterial[]>([]);
  const [materialError, setMaterialError] = useState('');
  useEffect(() => {
    Promise.all([
      apiRequest<PersonalMaterial[]>('/materials'),
      apiRequest<PersonalSettings>('/me/settings'),
    ])
      .then(([m, p]) => {
        setMaterials(m.filter((x) => x.kind === 'resume' && x.confirmed));
        const selected = m.find((x) => x.id === p.default_resume_id && x.confirmed);
        setConfig((c) => ({
          ...c,
          interviewer_style: p.interviewer_style ?? c.interviewer_style,
          ...(selected ? { resume_ref: { id: selected.id, version: selected.version } } : {}),
        }));
      })
      .catch(() => setMaterialError('简历暂时无法加载，可不带简历继续通用面试。'));
  }, []);
  const loadProfiles = useCallback(
    (signal: AbortSignal) => interviewsApi.profiles(config.job, config.career_stage, signal),
    [config.job, config.career_stage],
  );
  const profiles = useLiveResource(loadProfiles, () => false);
  const command = useLiveCommand();
  const change = <K extends keyof InterviewConfig>(key: K, value: InterviewConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const selected = jobs.find((j) => j.id === config.job);
  if (flow.phase !== 'idle' && flow.phase !== 'running') return <PreparationScreen />;
  return (
    <form
      className="setup-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void flow.begin(config);
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
              onChange={(e) => {
                const job = jobs.find((j) => j.id === e.target.value);
                if (job) setConfig((c) => selectInterviewJob(c, job));
              }}
            >
              <option value="" disabled>
                请选择岗位
              </option>
              {jobs.map((j) => (
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
              { value: 'internship' as const, label: '实习' },
              { value: 'campus' as const, label: '校招' },
            ].filter((option) => selected?.stages.includes(option.value))}
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
              { value: 10, label: '10 分钟' },
              { value: 20, label: '20 分钟' },
              { value: 30, label: '30 分钟' },
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
            最多 {mainQuestionLimit(config.duration_minutes)} 个主问题，每题最多 2
            次追问。达到目标时间后收尾，最多保留 2 分钟完成当前回答；暂停和断线仍计时。
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
            你可以为不同岗位保存多份简历，每次面试单独选择其中一份。只有已确认的简历可以使用。
          </p>
          {materialError && <p role="alert">{materialError}</p>}
          <label className="field-label" htmlFor="interview-resume">
            本次面试使用的简历
          </label>
          <select
            id="interview-resume"
            disabled={command.blocked}
            value={config.resume_ref?.id ?? ''}
            onChange={(e) => {
              const m = materials.find((x) => x.id === e.target.value);
              setConfig((c) => ({
                ...c,
                resume_ref: m ? { id: m.id, version: m.version } : undefined,
              }));
            }}
          >
            <option value="">不使用简历，进行通用面试</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · v{m.version}
              </option>
            ))}
          </select>
          {config.resume_ref && (
            <div className="resume-selection-summary">
              <strong>
                本次已选：{materials.find((m) => m.id === config.resume_ref?.id)?.title}
              </strong>
              <p>版本 v{config.resume_ref.version} · 开始后冻结，之后修改简历不会影响本次面试。</p>
            </div>
          )}
          {!materials.length && !materialError && (
            <p className="field-help">还没有已确认简历。请先创建并核对简历，再回来选择。</p>
          )}
          <Link href="/me/resumes" className="text-link">
            管理多份简历 / 新增岗位版简历 →
          </Link>
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
            options={[
              { value: 'text_fallback', label: '文字作答' },
              { value: 'realtime_voice', label: '语音面试' },
              { value: 'realtime_video', label: '视频面试' },
            ]}
            onChange={(v) => change('interaction_mode', v)}
            disabled={command.blocked}
          />
          <div className="privacy-checks">
            <span>
              {config.interaction_mode === 'realtime_voice' ? (
                <Mic size={14} />
              ) : (
                <MicOff size={14} />
              )}
              {config.interaction_mode === 'realtime_voice' ? '准备时授权麦克风' : '麦克风未采集'}
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
          {config.interaction_mode === 'realtime_video' && (
            <p className="field-help">
              准备时申请麦克风和摄像头，完成后自动进入视频房间。屏幕共享由你主动开启。画面不上传、不录像，语音沿用当前面试
              Agent。
            </p>
          )}
          {config.interaction_mode === 'realtime_voice' && (
            <p className="field-help">
              点击开启模拟面试后授权麦克风，设备和面试准备完成后自动进入语音对话，也可以随时切回文字。
            </p>
          )}
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
              {config.interaction_mode === 'realtime_voice' ? (
                <Mic size={13} />
              ) : (
                <Keyboard size={13} />
              )}
              {config.interaction_mode === 'realtime_video'
                ? '视频面试'
                : config.interaction_mode === 'realtime_voice'
                  ? '语音面试'
                  : '文字作答'}
            </strong>
          </div>
        </div>
        <p className="notice">
          回答会发送至 AI 模型。请勿填写联系方式等敏感信息；面试官会根据你的陈述继续提问。
        </p>
        <p className="field-help">准备和设备检查期间不计时，就绪后自动进入面试。</p>
        <CommandNotice command={command} />
        <Button
          type="submit"
          disabled={
            command.blocked ||
            !selected ||
            !selected.stages.includes(config.career_stage) ||
            !profiles.value ||
            Boolean(profiles.error)
          }
        >
          {command.busy ? '正在准备…' : '开启模拟面试'}
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
