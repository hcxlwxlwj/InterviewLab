'use client';
import { JOBS, JOB_CATEGORIES, getJob } from '@interviewlab/backend/content';
import {
  TYPE_LABELS,
  defaultConfiguration,
  templateJd,
  type Configuration,
  type JobTarget,
} from '@interviewlab/core';
import {
  ArrowRight,
  CameraOff,
  Check,
  FileText,
  Keyboard,
  MicOff,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Breadcrumb,
  DemoNotice,
  Footer,
  Header,
  Loading,
  Modal,
  useDemoState,
} from '../../../components/shared';
import { TargetEditor, emptyTarget } from '../../../components/target-editor';
import { Button } from '../../../components/ui/button';
import { demoClient, newConfiguration } from '../../../lib/demo-client';

function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset className="field-group">
      <legend className="field-label">{label}</legend>
      <div className="choices">
        {options.map((o) => (
          <label className="choice" key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Setup() {
  const router = useRouter();
  const search = useSearchParams();
  const state = useDemoState();
  const [config, setConfig] = useState<Configuration>(defaultConfiguration());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [showResume, setShowResume] = useState(false);
  const [targetDraft, setTargetDraft] = useState<JobTarget | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!state) return;
    try {
      const targetId = search.get('target');
      const target = state.job_targets.find((t) => t.id === targetId);
      if (targetId && !target) throw new Error('个人 JD 已不可用，请返回目标岗位重新选择。');
      const next = newConfiguration(target?.job || search.get('job') || undefined);
      if (target)
        Object.assign(next, {
          job_target_id: target.id,
          job_target_version: target.version,
          jd_text: target.jd_text,
          jd_source: 'custom',
        });
      const selectedId = search.get('resume') || target?.preferred_resume_id;
      if (selectedId) {
        const resume = state.resumes.find((r) => r.id === selectedId);
        if (!resume) throw new Error('所选简历已不可用，请返回简历库重新选择。');
        next.resume_document_id = resume.id;
        next.resume_document_version = resume.version;
        next.focus_experience_ids = [];
      }
      setConfig(next);
      setError('');
      setUnavailable(false);
    } catch (e) {
      setError((e as Error).message);
      setUnavailable(true);
      setConfig((c) => ({
        ...c,
        job: '',
        jd_text: '',
        job_target_id: undefined,
        job_target_version: undefined,
        job_template_version: undefined,
      }));
    }
    // Reinitialize only for a changed URL or the first storage load, not a save notification.
  }, [search, !!state]);
  const change = <K extends keyof Configuration>(key: K, value: Configuration[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  function selectResume(id?: string) {
    setConfig((c) => ({
      ...c,
      resume_document_id: id,
      resume_document_version: state?.resumes.find((r) => r.id === id)?.version,
      focus_experience_ids: [],
    }));
  }
  function start(event: React.FormEvent) {
    event.preventDefault();
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      const session = demoClient.createSession(config);
      router.push(`/interview/${session.id}`);
    } catch (e) {
      setStarting(false);
      setError(e instanceof Error ? e.message : '暂时无法开始，请重试。');
    }
  }
  const selectedResume = state?.resumes.find((r) => r.id === config.resume_document_id);
  const experiences =
    state?.experiences.filter((e) => e.resume_document_id === selectedResume?.id && e.confirmed) ??
    [];
  const template = getJob(config.job);
  return (
    <>
      <Header />
      <main className="container page-body" id="main-content">
        <Breadcrumb items={['面试配置']} />
        <div className="page-heading">
          <div>
            <h1>配置你的模拟面试</h1>
            <p>选择一个方向，从你最熟悉的经历开始。</p>
          </div>
          <span className="badge badge-mint">
            <ShieldCheck size={13} />
            设备默认关闭
          </span>
        </div>
        {!state ? (
          <Loading />
        ) : (
          <form onSubmit={start} className="setup-grid">
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
                    onChange={(e) => {
                      const j = getJob(e.target.value)!;
                      setConfig((c) => ({
                        ...c,
                        job: j.id,
                        job_template_version: j.version,
                        job_target_id: undefined,
                        job_target_version: undefined,
                        jd_text: c.jd_source === 'custom' ? c.jd_text : templateJd(j),
                        code_assessment_enabled: j.code_relevant && c.code_assessment_enabled,
                      }));
                      setUnavailable(false);
                      setError('');
                    }}
                  >
                    <option value="" disabled>
                      请选择可用岗位
                    </option>
                    {JOB_CATEGORIES.map((cat) => (
                      <optgroup key={cat.id} label={cat.title}>
                        {JOBS.filter((j) => j.category_id === cat.id).map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <Link href="/jobs" className="text-link">
                    查看岗位职责与考查主题 →
                  </Link>
                </div>
                <Choices
                  label="JD 来源"
                  name="jd-source"
                  value={config.jd_source ?? 'template'}
                  options={[
                    { value: 'template', label: '平台岗位模板' },
                    { value: 'custom', label: '个人 / 自定义 JD' },
                  ]}
                  onChange={(v) =>
                    setConfig((c) => ({
                      ...c,
                      jd_source: v,
                      jd_text: v === 'template' && template ? templateJd(template) : '',
                      job_target_id: undefined,
                      job_target_version: undefined,
                    }))
                  }
                />
                {config.jd_source === 'custom' && state.job_targets.length > 0 && (
                  <div className="field-group">
                    <label className="field-label" htmlFor="saved-target">
                      已保存的个人 JD
                    </label>
                    <select
                      id="saved-target"
                      value={config.job_target_id ?? ''}
                      onChange={(e) => {
                        const t = state.job_targets.find((t) => t.id === e.target.value);
                        if (!t) {
                          setConfig((c) => ({
                            ...c,
                            job_target_id: undefined,
                            job_target_version: undefined,
                            jd_text: '',
                          }));
                          return;
                        }
                        const r = state.resumes.find((r) => r.id === t.preferred_resume_id);
                        setConfig((c) => ({
                          ...c,
                          job: t.job,
                          job_template_version: getJob(t.job)?.version,
                          job_target_id: t.id,
                          job_target_version: t.version,
                          jd_text: t.jd_text,
                          resume_document_id: r?.id ?? c.resume_document_id,
                          resume_document_version: r?.version ?? c.resume_document_version,
                          focus_experience_ids: [],
                          code_assessment_enabled:
                            !!getJob(t.job)?.code_relevant && c.code_assessment_enabled,
                        }));
                      }}
                    >
                      <option value="">新粘贴一份 JD</option>
                      {state.job_targets.map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.title}
                          {t.company ? ` · ${t.company}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Choices
                  label="准备阶段"
                  name="career-stage"
                  value={config.career_stage ?? 'campus'}
                  options={[
                    { value: 'internship', label: '实习' },
                    { value: 'campus', label: '校招' },
                  ]}
                  onChange={(v) => change('career_stage', v)}
                />
                <Choices
                  label="面试类型"
                  name="type"
                  value={config.interview_type}
                  options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
                    value: value as Configuration['interview_type'],
                    label,
                  }))}
                  onChange={(v) => change('interview_type', v)}
                />
                <Choices
                  label="面试难度"
                  name="difficulty"
                  value={config.difficulty}
                  options={(['基础', '进阶', '挑战'] as const).map((v) => ({ value: v, label: v }))}
                  onChange={(v) => change('difficulty', v)}
                />
                <div className="field-group">
                  <label className="field-label" htmlFor="jd">
                    岗位 JD <span className="muted">（可选）</span>
                  </label>
                  <textarea
                    id="jd"
                    rows={3}
                    maxLength={10000}
                    placeholder="粘贴目标岗位描述，或直接使用岗位通用模板。演示中请使用虚构内容。"
                    value={config.jd_text}
                    readOnly={config.jd_source !== 'custom'}
                    onChange={(e) => change('jd_text', e.target.value)}
                  />
                  <p className="field-help">
                    {config.jd_source === 'custom'
                      ? '当前仅保存 JD，不自动分析内容。'
                      : '平台整理的通用参考，支持切换到自定义 JD 后编辑。'}
                  </p>
                  {config.jd_source === 'custom' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const previous = state.job_targets.find(
                          (t) => t.id === config.job_target_id,
                        );
                        setTargetDraft({
                          ...(previous ?? emptyTarget(config.job)),
                          title: previous?.title ?? template?.title ?? '',
                          job: config.job,
                          jd_text: config.jd_text,
                          preferred_resume_id: config.resume_document_id,
                        });
                      }}
                    >
                      保存到个人 JD
                    </Button>
                  )}
                  {message && (
                    <p className="toast-inline" role="status">
                      {message}
                    </p>
                  )}
                </div>
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
                    { value: 5 as const, label: '5 分钟' },
                    { value: 10 as const, label: '10 分钟' },
                  ]}
                  onChange={(v) => change('duration_minutes', v)}
                />
                <Choices
                  label="面试官风格"
                  name="style"
                  value={config.interviewer_style}
                  options={(['标准', '友好', '深入追问'] as const).map((v) => ({
                    value: v,
                    label: v,
                  }))}
                  onChange={(v) => change('interviewer_style', v)}
                />
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={config.code_assessment_enabled}
                    disabled={!template?.code_relevant}
                    onChange={(e) => change('code_assessment_enabled', e.target.checked)}
                  />
                  <span>
                    包含代码工作区
                    <small>
                      {template?.code_relevant
                        ? 'C++ / Python / Java 编辑演示，未接入真实运行服务。'
                        : '此类岗位默认不考查代码能力。'}
                    </small>
                  </span>
                </label>
                <p className="field-help">
                  最多 6 个主问题，每题最多 2 次追问。暂停仍计时，总经过时间达到 12 分钟自动结束。
                </p>
              </section>
              <section className="panel form-panel">
                <div className="form-panel-title">
                  <span className="section-number">03</span>
                  <div>
                    <h2>简历与重点经历</h2>
                  </div>
                </div>
                <fieldset className="field-group">
                  <legend className="field-label">选择简历</legend>
                  <div className="resume-choices">
                    {state.resumes.map((r) => (
                      <label className="choice resume-choice" key={r.id}>
                        <input
                          type="radio"
                          name="resume"
                          checked={config.resume_document_id === r.id}
                          onChange={() => selectResume(r.id)}
                        />
                        <FileText size={19} />
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.is_sample ? '合成样例' : '文本简历'} · v{r.version}
                            {r.is_default ? ' · 默认' : ''}
                          </small>
                        </span>
                      </label>
                    ))}
                    <label className="choice resume-choice">
                      <input
                        type="radio"
                        name="resume"
                        checked={!config.resume_document_id}
                        onChange={() => selectResume()}
                      />
                      <span>
                        <strong>不使用简历</strong>
                        <small>从岗位通用问答开始</small>
                      </span>
                    </label>
                  </div>
                  <p className="field-help">
                    切换简历后需要重新选择已确认的经历。
                    <Link href="/me/resumes" className="text-link">
                      管理简历 →
                    </Link>
                  </p>
                </fieldset>
                {experiences.length > 0 && (
                  <fieldset className="field-group">
                    <legend className="field-label">
                      重点经历 <span className="muted">（可选）</span>
                    </legend>
                    {experiences.map((e) => (
                      <label className="check-row" key={e.id}>
                        <input
                          type="checkbox"
                          checked={config.focus_experience_ids.includes(e.id)}
                          onChange={(ev) =>
                            change(
                              'focus_experience_ids',
                              ev.target.checked
                                ? [...config.focus_experience_ids, e.id]
                                : config.focus_experience_ids.filter((id) => id !== e.id),
                            )
                          }
                        />
                        <span>
                          {e.title}
                          <small>{e.personal_role}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {selectedResume && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResume(true)}
                  >
                    <FileText size={14} />
                    查看简历内容
                  </Button>
                )}
              </section>
              <section className="panel form-panel">
                <div className="form-panel-title">
                  <span className="section-number">04</span>
                  <div>
                    <h2>作答方式</h2>
                  </div>
                </div>
                <Choices
                  name="mode"
                  label="交互方式"
                  value={config.interaction_mode}
                  options={[
                    { value: 'text_fallback', label: '文字作答' },
                    { value: 'realtime_voice', label: '实时语音 · 流程预览' },
                  ]}
                  onChange={(v) => change('interaction_mode', v)}
                />
                {config.interaction_mode === 'realtime_voice' && (
                  <div className="notice">
                    <MicOff size={16} />
                    <span>语音服务尚未接入。开始时将明确切换为文字作答，不会申请麦克风权限。</span>
                  </div>
                )}
                <div className="device-status">
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
                    复盘媒体不保存
                  </span>
                </div>
              </section>
            </div>
            <aside className="panel setup-summary">
              <h2>这一次，练习什么</h2>
              <div className="summary-rows">
                <div className="summary-row">
                  <span>目标岗位</span>
                  <strong>{JOBS.find((j) => j.id === config.job)?.title}</strong>
                </div>
                <div className="summary-row">
                  <span>面试类型</span>
                  <strong>{TYPE_LABELS[config.interview_type]}</strong>
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
                  <span>所选简历</span>
                  <strong>
                    {selectedResume
                      ? `${selectedResume.name} · v${selectedResume.version}`
                      : '不使用简历'}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>重点经历</span>
                  <strong>
                    {config.focus_experience_ids.length
                      ? `${config.focus_experience_ids.length} 个项目`
                      : '岗位通用问答'}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>代码工作区</span>
                  <strong>{config.code_assessment_enabled ? '包含编辑演示' : '不包含'}</strong>
                </div>
                <div className="summary-row">
                  <span>实际作答</span>
                  <strong>
                    <Keyboard
                      size={13}
                      style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                    />
                    文字作答
                  </strong>
                </div>
              </div>
              <DemoNotice compact />
              {error && (
                <div className="error-inline" role="alert">
                  {error}
                </div>
              )}
              {unavailable && (
                <Link href="/jobs" className="text-link">
                  重新选择岗位 →
                </Link>
              )}
              <Button type="submit" disabled={starting || unavailable}>
                {starting
                  ? '正在准备…'
                  : config.interaction_mode === 'realtime_voice'
                    ? '切换文字并开始'
                    : '开始模拟面试'}
                <ArrowRight size={17} />
              </Button>
            </aside>
          </form>
        )}
      </main>
      <Footer />
      {targetDraft && state && (
        <TargetEditor
          target={targetDraft}
          resumes={state.resumes}
          onClose={(saved) => {
            setTargetDraft(null);
            if (saved) {
              setConfig((c) => ({
                ...c,
                job: saved.job,
                job_template_version: getJob(saved.job)?.version,
                job_target_id: saved.id,
                job_target_version: saved.version,
                jd_text: saved.jd_text,
                jd_source: 'custom',
                resume_document_id: saved.preferred_resume_id,
                resume_document_version: state.resumes.find(
                  (r) => r.id === saved.preferred_resume_id,
                )?.version,
                focus_experience_ids: [],
              }));
              setMessage('已保存为个人 JD。');
            }
          }}
        />
      )}
      <Modal
        open={showResume}
        onOpenChange={setShowResume}
        title={selectedResume?.name ?? '示例简历'}
        description={
          selectedResume?.is_sample ? '当前为合成样例。' : '当前标签页中保存的文本简历。'
        }
      >
        {selectedResume?.content && (
          <div className="resume-preview-item">
            <h3>{selectedResume.content.full_name}</h3>
            {(['education', 'skills', 'summary', 'raw_text'] as const).map((key) =>
              selectedResume.content?.[key] ? (
                <p key={key} style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedResume.content[key]}
                </p>
              ) : null,
            )}
          </div>
        )}
        {experiences.map((e) => (
          <div className="resume-preview-item" key={e.id}>
            <h3>{e.title}</h3>
            <p className="small muted">本人职责：{e.personal_role}</p>
            <p className="small">{e.actions}</p>
            <p className="small muted">技术选择：{e.technical_decisions}</p>
            <p className="small muted">验证与结果：{e.results}</p>
          </div>
        ))}
      </Modal>
    </>
  );
}
export default function SetupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Setup />
    </Suspense>
  );
}
