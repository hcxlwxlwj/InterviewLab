import type { ReactNode } from 'react';
import type { JobTemplate } from '@interviewlab/core';
import { Camera, CameraOff, Check, Mic, MicOff } from 'lucide-react';
import { Choices } from '../../components/interview-setup';
import { ErrorNotice } from './common';
import type { SetupConfiguration, SetupConfigurationOptions } from './setup-controller';
import { SelectedSetupJob, SetupJobSelection, SetupResumeSelection } from './setup-fields';

function SetupPanel({
  number,
  title,
  children,
  className = '',
}: {
  number: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel form-panel ${className}`}>
      <div className="form-panel-title">
        <span className="section-number">{number}</span>
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function SetupStage({ model }: { model: SetupConfiguration }) {
  return (
    <Choices
      label="准备阶段"
      name="career-stage"
      value={model.config.career_stage}
      options={[
        { value: 'internship' as const, label: '实习' },
        { value: 'campus' as const, label: '校招' },
      ].filter((option) => model.selected?.stages.includes(option.value))}
      onChange={(value) => model.change('career_stage', value)}
      disabled={model.blocked}
    />
  );
}

function SetupInterviewType({ model }: { model: SetupConfiguration }) {
  return (
    <>
      <ErrorNotice message={model.profiles.error} retry={() => void model.profiles.refresh()} />
      <Choices
        label="面试类型"
        name="interview-type"
        value={model.config.interview_type}
        options={(model.profiles.value?.profiles ?? []).map((profile) => ({
          value: profile.type,
          label: profile.label,
        }))}
        onChange={(value) => model.change('interview_type', value)}
        disabled={model.blocked}
      />
      <Choices
        label="面试难度"
        name="difficulty"
        value={model.config.difficulty}
        options={[{ value: '基础', label: '基础' }]}
        disabled={model.blocked}
        onChange={(value) => model.change('difficulty', value)}
      />
    </>
  );
}

function SetupDirection({
  model,
  initialJob,
  jobs,
  fixedJob,
}: {
  model: SetupConfiguration;
  initialJob: JobTemplate;
  jobs: JobTemplate[];
  fixedJob: boolean;
}) {
  return (
    <SetupPanel number="01" title="面试方向">
      {fixedJob ? (
        <SelectedSetupJob job={initialJob} />
      ) : (
        <SetupJobSelection
          jobs={jobs}
          value={model.config.job}
          disabled={model.blocked}
          onChange={model.selectJob}
        />
      )}
      {!model.selected && <p role="alert">所选岗位已不可用，请重新选择。</p>}
      <SetupStage model={model} />
      <SetupInterviewType model={model} />
    </SetupPanel>
  );
}

function SetupPreferences({ model }: { model: SetupConfiguration }) {
  return (
    <SetupPanel number="02" title="面试设置">
      <Choices
        label="目标时长"
        name="duration"
        value={model.config.duration_minutes}
        options={[
          { value: 10, label: '10 分钟' },
          { value: 20, label: '20 分钟' },
          { value: 30, label: '30 分钟' },
        ]}
        onChange={(value) => model.change('duration_minutes', value)}
        disabled={model.blocked}
      />
      <Choices
        label="面试官风格"
        name="style"
        value={model.config.interviewer_style}
        options={(['标准', '友好', '深入追问'] as const).map((value) => ({ value, label: value }))}
        onChange={(value) => model.change('interviewer_style', value)}
        disabled={model.blocked}
      />
      <p className="field-help">暂停和断线期间仍计时。</p>
    </SetupPanel>
  );
}

function SetupResume({ model }: { model: SetupConfiguration }) {
  return (
    <SetupPanel number="03" title="面试简历">
      {model.materialError && <p role="alert">{model.materialError}</p>}
      <SetupResumeSelection
        materials={model.materials}
        disabled={model.blocked}
        value={model.config.resume_ref?.id ?? ''}
        onChange={model.selectResume}
      />
      {!model.materials.length && !model.materialError && (
        <p className="field-help">还没有已确认简历。请先创建并核对简历，再回来选择。</p>
      )}
    </SetupPanel>
  );
}

function SetupMediaPrivacy({ model }: { model: SetupConfiguration }) {
  const voice = model.config.interaction_mode !== 'text_fallback';
  const video = model.config.interaction_mode === 'realtime_video';
  return (
    <div className="setup-media-status">
      <span>
        {voice ? <Mic size={14} /> : <MicOff size={14} />}
        {voice ? '准备时授权麦克风' : '麦克风未采集'}
      </span>
      <span>
        {video ? <Camera size={14} /> : <CameraOff size={14} />}
        {video ? '准备时授权摄像头' : '摄像头关闭'}
      </span>
      <span>
        <Check size={14} />
        不保存音视频
      </span>
    </div>
  );
}

function SetupInteraction({ model }: { model: SetupConfiguration }) {
  return (
    <SetupPanel number="04" title="作答方式" className="setup-interaction-panel">
      <Choices
        label="交互方式"
        name="interaction-mode"
        value={model.config.interaction_mode}
        options={[
          { value: 'text_fallback', label: '文字作答' },
          { value: 'realtime_voice', label: '语音面试' },
          { value: 'realtime_video', label: '视频面试' },
        ]}
        onChange={(value) => model.change('interaction_mode', value)}
        disabled={model.blocked}
      />
      <SetupMediaPrivacy model={model} />
      {model.config.interaction_mode === 'realtime_video' && (
        <p className="field-help">
          开始时申请麦克风和摄像头权限，屏幕共享需手动开启。画面不上传、不录像。
        </p>
      )}
      {model.config.interaction_mode === 'realtime_voice' && (
        <p className="field-help">
          点击开启模拟面试后授权麦克风，设备和面试准备完成后自动进入语音对话，也可以随时切回文字。
        </p>
      )}
    </SetupPanel>
  );
}

export function SetupPanels({
  model,
  ...options
}: SetupConfigurationOptions & { model: SetupConfiguration }) {
  return (
    <div className="setup-panels">
      <SetupDirection model={model} {...options} />
      <SetupPreferences model={model} />
      <SetupResume model={model} />
      <SetupInteraction model={model} />
    </div>
  );
}
