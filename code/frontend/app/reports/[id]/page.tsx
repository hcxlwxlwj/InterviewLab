'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowRight,
  CameraOff,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  MicOff,
  RotateCcw,
} from 'lucide-react';
import {
  DIMENSION_LABELS,
  JOBS,
  TYPE_LABELS,
  elapsedSeconds,
  type JobStatus,
  type Session,
} from '@interviewlab/core';
import {
  Breadcrumb,
  EmptyState,
  Footer,
  Header,
  Loading,
  formatDate,
  formatTime,
  useDemoState,
} from '../../../components/shared';
import { Button } from '../../../components/ui/button';
import { demoClient } from '../../../lib/demo-client';
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const state = useDemoState();
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<'review' | 'compare'>('review');
  const [preview, setPreview] = useState<'actual' | JobStatus>('actual');
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const [comparisonId, setComparisonId] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 800);
    return () => clearInterval(timer);
  }, []);
  const session = state?.sessions.find((s) => s.id === id);
  const report = session ? demoClient.getReport(session, now) : undefined;
  const status = preview === 'actual' ? report?.status : preview;
  const finished = session?.status === 'completed' || session?.status === 'failed';
  const retries =
    state?.sessions.filter(
      (s) => s.parent_session_id === id && ['completed', 'failed'].includes(s.status),
    ) ?? [];
  const chosenRetry = state?.sessions.find((s) => s.id === comparisonId) ?? retries[0];
  const original = session?.parent_session_id
    ? state?.sessions.find((s) => s.id === session.parent_session_id)
    : session;
  const retry = session?.parent_session_id ? session : chosenRetry;
  const sourceTurn = original?.turns.find((t) => t.id === retry?.parent_turn_id);
  const retryTurn = retry?.turns.find((t) => t.action === 'answer');
  async function startRetry(source: Session, turnId: string) {
    if (retrying) return;
    setRetrying(true);
    setError('');
    try {
      const next = demoClient.createSession(source.configuration, {
        session_id: source.id,
        turn_id: turnId,
      });
      router.push(`/interview/${next.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '暂时无法开始重练');
      setRetrying(false);
    }
  }
  function retryReport() {
    setPreview('generating');
    window.setTimeout(() => setPreview('actual'), 1400);
  }
  return (
    <>
      <Header />
      <main className="container page-body" id="main-content">
        <Breadcrumb items={['我的面试', '分析报告']} />
        {!state ? (
          <Loading />
        ) : !session || !report ? (
          <EmptyState
            title="报告暂时找不到了"
            description="记录可能已删除，或不在当前标签页中。可以查看现有记录，或打开一份合成示例。"
            href="/me"
            action="查看我的面试"
          />
        ) : (
          <>
            <div className="page-heading report-page-heading">
              <div>
                <h1>每一次复盘，都有下一步</h1>
                <p>
                  {session.material_snapshot.job_template?.title ??
                    JOBS.find((j) => j.id === session.configuration.job)?.title}{' '}
                  · {TYPE_LABELS[session.interview_type]} · 文字作答 ·{' '}
                  {formatTime(elapsedSeconds(session))}
                </p>
              </div>
              <div className="page-actions">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/me/interviews">
                    <FileText size={14} />
                    查看记录
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/interview/setup?job=${session.configuration.job}`}>
                    <RotateCcw size={14} />
                    重新面试
                  </Link>
                </Button>
              </div>
            </div>
            <div className="report-banner">
              <div>
                <Info size={16} />
                <span>
                  {session.is_sample
                    ? '合成示例：分数与点评仅用于展示，不代表真实测评。'
                    : '回答已记录。演示模式不生成专业评分。'}
                </span>
              </div>
              {session.is_sample && (
                <label className="status-preview-label">
                  状态预览
                  <select
                    aria-label="报告状态预览"
                    value={preview}
                    onChange={(e) => setPreview(e.target.value as typeof preview)}
                  >
                    <option value="actual">就绪</option>
                    <option value="generating">生成中</option>
                    <option value="failed">生成失败</option>
                  </select>
                </label>
              )}
            </div>
            {!finished ? (
              <div className="panel">
                <EmptyState
                  title="这场面试还没有结束"
                  description="请先完成或结束面试，再查看本场记录。进行中不展示评分和建议。"
                  href={`/interview/${id}`}
                  action="返回面试"
                />
              </div>
            ) : status === 'generating' || status === 'pending' ? (
              <div className="panel report-state">
                <span className="spinner" />
                <h2>回答已记录，正在整理报告</h2>
                <p>演示会展示报告状态的变化。你可以离开这里，再从记录中回来。</p>
                <Button variant="outline" asChild>
                  <Link href="/me">返回我的面试</Link>
                </Button>
                {preview !== 'actual' && (
                  <Button variant="ghost" onClick={() => setPreview('actual')}>
                    结束状态预览
                  </Button>
                )}
              </div>
            ) : status === 'failed' ? (
              <div className="panel report-state">
                <Info size={32} />
                <h2>报告暂时没有生成成功</h2>
                <p>这是失败状态的演示。已提交的回答仍然保留，重试不需要重新面试。</p>
                <Button onClick={retryReport}>
                  <RotateCcw size={16} />
                  重试整理报告
                </Button>
              </div>
            ) : (
              <>
                {session.status === 'failed' && (
                  <div className="notice">
                    本场面试中断，以下仅包含已保存的部分回答，不代表完整考查。
                  </div>
                )}
                {error && (
                  <div className="error-inline" role="alert">
                    {error}
                  </div>
                )}
                <div className="report-grid">
                  <section className="report-detail">
                    <div className="content-tabs" role="tablist" aria-label="报告视图">
                      <button
                        id="review-tab"
                        role="tab"
                        aria-selected={tab === 'review'}
                        aria-controls="review-panel"
                        tabIndex={tab === 'review' ? 0 : -1}
                        className={tab === 'review' ? 'selected' : ''}
                        onClick={() => setTab('review')}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowRight') {
                            setTab('compare');
                            document.getElementById('compare-tab')?.focus();
                          }
                        }}
                      >
                        <FileText size={15} />
                        逐题复盘
                      </button>
                      <button
                        id="compare-tab"
                        role="tab"
                        aria-selected={tab === 'compare'}
                        aria-controls="compare-panel"
                        tabIndex={tab === 'compare' ? 0 : -1}
                        className={tab === 'compare' ? 'selected' : ''}
                        onClick={() => setTab('compare')}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            setTab('review');
                            document.getElementById('review-tab')?.focus();
                          }
                        }}
                      >
                        <ArrowLeftRight size={15} />
                        重练对比
                      </button>
                    </div>
                    {tab === 'review' ? (
                      <div
                        id="review-panel"
                        role="tabpanel"
                        aria-labelledby="review-tab"
                        className="turn-reviews"
                      >
                        {session.turns.length === 0 ? (
                          <div className="panel">
                            <EmptyState
                              title="本场没有已提交的回答"
                              description="未提交草稿和跳过题目不会被当作有效回答，也不会自动记为零分。"
                              href="/interview/setup"
                            />
                          </div>
                        ) : (
                          session.turns.map((t, i) => (
                            <details className="panel turn-review" key={t.id} open={i === 0}>
                              <summary>
                                <span className="review-number">
                                  {String(t.main_question_index).padStart(2, '0')}
                                  {t.follow_up_index ? <small>.{t.follow_up_index}</small> : null}
                                </span>
                                <span>
                                  {t.text}
                                  <small>
                                    {t.follow_up_index ? '连续追问' : '主问题'} · 文字作答 · 回答 v
                                    {t.revision}
                                  </small>
                                </span>
                                <ChevronDown size={17} />
                              </summary>
                              <div className="turn-review-body">
                                <div className="answer-quote">
                                  <span className="quote-label">
                                    {session.is_sample ? '原回答 · 合成示例' : '你的原回答'}
                                  </span>
                                  <p>
                                    {t.action === 'skip'
                                      ? '此题已跳过，不计为有效回答。'
                                      : t.answer_text}
                                  </p>
                                </div>
                                {t.action !== 'skip' && (
                                  <>
                                    {session.is_sample ? (
                                      <>
                                        <div className="review-feedback">
                                          <ClipboardCheck size={17} />
                                          <div>
                                            <strong>
                                              {i === 0
                                                ? '示例观察：个人职责与团队分工有区分'
                                                : i === 1
                                                  ? '示例观察：进一步说明了协作边界'
                                                  : '示例观察：描述了具体问题与实现调整'}
                                            </strong>
                                            <p>
                                              {i === 0
                                                ? '原回答明确列出了自己完成的模块，也交代了后端接口由同学负责。可以继续补充一个实现取舍和验证过程。'
                                                : '可以继续检查：是否讲清了当时的选择、自己的行动，以及你用什么依据判断实现有效。'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="evidence">
                                          <span>
                                            引用依据 · 第 {t.main_question_index} 题
                                            {t.follow_up_index ? `追问 ${t.follow_up_index}` : ''} /
                                            回答 v{t.revision}
                                          </span>
                                          <blockquote>
                                            “
                                            {i === 0
                                              ? '我主要负责商品列表、搜索筛选和发布表单'
                                              : t.answer_text.slice(0, 46)}
                                            ”
                                          </blockquote>
                                        </div>
                                        <div className="reference-points">
                                          <strong>
                                            参考复盘方向{' '}
                                            <span className="muted">· 基于本条示例</span>
                                          </strong>
                                          <p>
                                            说明本人职责 → 选择一个具体行动 → 解释技术取舍 →
                                            交代已做的验证。未知或未做的部分如实说明，不补造结果。
                                          </p>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="review-feedback neutral-feedback">
                                        <Info size={16} />
                                        <div>
                                          <strong>本条仅保存作答，不提供自动点评</strong>
                                          <p>
                                            未接入评估服务。你可以重新阅读原文，或用同一道题再练一次。
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {session.material_snapshot.job_template?.questions
                                      .filter((q) => q.id === t.knowledge_question_id)
                                      .map((q) => (
                                        <details className="reference-observations" key={q.id}>
                                          <summary>查看本题准备要点 · 平台整理</summary>
                                          <p>{q.intent}</p>
                                          <p>{q.observation_points.join('、')}</p>
                                          <ul>
                                            {q.follow_ups.map((f) => (
                                              <li key={f}>{f}</li>
                                            ))}
                                          </ul>
                                          <p className="muted">
                                            通用观察方向，不是对本次回答的评分或自动点评。模板 v
                                            {session.material_snapshot.job_template?.version}
                                          </p>
                                          {session.material_snapshot.knowledge_sources
                                            ?.filter((s) => q.source_refs.includes(s.id))
                                            .map((s) => (
                                              <a
                                                className="text-link"
                                                key={s.id}
                                                href={s.url}
                                                target="_blank"
                                                rel="noreferrer"
                                              >
                                                {s.title} ↗
                                              </a>
                                            ))}
                                        </details>
                                      ))}
                                    <div className="turn-review-actions">
                                      <span>
                                        {session.is_sample
                                          ? '示例点评不是标准答案'
                                          : '保留原回答，不用新回答覆盖'}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={retrying}
                                        onClick={() => startRetry(session, t.id)}
                                      >
                                        <RotateCcw size={13} />
                                        重练此题
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </details>
                          ))
                        )}
                        {Boolean(session.code_submissions?.length) && (
                          <div className="panel panel-pad">
                            <h3>代码草稿记录</h3>
                            <p className="field-help">
                              以下草稿未真实执行或评审，不计入代码能力分数。
                            </p>
                            {session.code_submissions?.map((c, i) => (
                              <details className="code-review-record" key={i}>
                                <summary>
                                  {c.language.toUpperCase()} · 草稿 v{c.revision} ·{' '}
                                  {formatDate(c.submitted_at)}
                                </summary>
                                <pre>{c.source_code}</pre>
                              </details>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        id="compare-panel"
                        role="tabpanel"
                        aria-labelledby="compare-tab"
                        className="panel comparison-panel"
                      >
                        {sourceTurn && retryTurn ? (
                          <>
                            <div className="panel-heading">
                              <h2>同一道题，两次回答</h2>
                              <span className="badge badge-mint">保留原文</span>
                            </div>
                            {!session.parent_session_id && retries.length > 1 && (
                              <label className="field-label">
                                选择重练记录
                                <select
                                  value={retry?.id}
                                  onChange={(e) => setComparisonId(e.target.value)}
                                >
                                  {retries.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {formatDate(s.started_at)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <p className="comparison-question">{sourceTurn.text}</p>
                            <div className="comparison-columns">
                              <div>
                                <span className="badge badge-neutral">
                                  原回答 · v{sourceTurn.revision}
                                </span>
                                <p>{sourceTurn.answer_text}</p>
                              </div>
                              <div>
                                <span className="badge badge-mint">
                                  重练回答 · v{retryTurn.revision}
                                </span>
                                <p>{retryTurn.answer_text}</p>
                              </div>
                            </div>
                            <div className="notice">
                              <Info size={16} />
                              <span>
                                两次均为文字作答，仅并列保存内容，不自动判断能力提升。字数增加不等于进步；本版本不提供真实语音或专业评估比较。
                              </span>
                            </div>
                            {session.parent_session_id && (
                              <Link className="text-link" href={`/reports/${original?.id}`}>
                                查看原场次报告
                                <ArrowRight size={14} />
                              </Link>
                            )}
                          </>
                        ) : (
                          <EmptyState
                            title="选一道题，再试一次"
                            description="从逐题复盘中点击“重练此题”。完成后，这里会保留原回答与新回答，方便你自己核对变化。"
                          />
                        )}
                      </div>
                    )}
                  </section>
                  <aside className="report-sidebar">
                    <section className="panel score-panel">
                      <div className="panel-heading">
                        <h2>{session.is_sample ? '示例总分' : '专业评分'}</h2>
                        <span className="badge badge-yellow">
                          {session.is_sample ? '合成示例' : '尚未评估'}
                        </span>
                      </div>
                      <div className="score-summary">
                        <strong>{report.overall_score ?? '—'}</strong>
                        {report.overall_score !== null && <span>/ 100</span>}
                        <p>
                          {report.overall_score === null
                            ? '当前不生成真实分数'
                            : '仅按已观察维度等权平均'}
                        </p>
                      </div>
                      <div className="score-dimensions">
                        {Object.entries(report.dimensions).map(([key, d]) => (
                          <div className="dimension" key={key}>
                            <div>
                              <span>{DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}</span>
                              <strong>{d.score ?? '未观察'}</strong>
                            </div>
                            <div className="dimension-track">
                              {d.score !== null && <span style={{ width: `${d.score}%` }} />}
                            </div>
                          </div>
                        ))}
                      </div>
                      <details className="score-notes">
                        <summary>查看评分依据</summary>
                        {Object.entries(report.dimensions).map(([key, d]) => (
                          <p key={key}>
                            <strong>
                              {DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}
                            </strong>
                            ：{d.explanation}
                          </p>
                        ))}
                      </details>
                      <div className="coverage">
                        <Check size={13} />
                        {report.coverage}
                      </div>
                    </section>
                    <section className="panel observations-panel">
                      <div className="panel-heading">
                        <h2>表达观测</h2>
                        <span className="badge badge-neutral">独立于专业分</span>
                      </div>
                      <div className="observation-row">
                        <MicOff size={17} />
                        <div>
                          <strong>语速、停顿、音量与音高</strong>
                          <p>不可用 · 本场为文字作答</p>
                        </div>
                      </div>
                      <div className="observation-row">
                        <CameraOff size={17} />
                        <div>
                          <strong>镜头表现</strong>
                          <p>摄像头未开启，无相关观测</p>
                        </div>
                      </div>
                      <div className="observation-row">
                        <FileText size={17} />
                        <div>
                          <strong>音视频回放</strong>
                          <p>未采集或保存，无法回放</p>
                        </div>
                      </div>
                    </section>
                    <section className="panel export-panel">
                      <div>
                        <Download size={17} />
                        <h3>导出 PDF</h3>
                      </div>
                      <p>报告导出服务尚未接入，当前可以在页面中查看作答。</p>
                      <Button variant="outline" size="sm" disabled>
                        暂不可用
                      </Button>
                    </section>
                  </aside>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
