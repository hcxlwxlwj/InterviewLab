'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ChartNoAxesCombined, ArrowRight, ArrowUpRight, Target } from 'lucide-react';
import { summarizePerformance, FEEDBACK_DIMENSIONS } from '@interviewlab/core';
import { interviewsApi } from '../../lib/api/interviews';
import { Button } from '../../components/ui/button';
import { Loading } from '../../components/shared';
import { ErrorNotice, useLiveResource } from '../live-interview/common';
const labels: Record<string, string> = {
  technical_knowledge: '专业知识',
  project_communication: '项目表达',
  logical_expression: '逻辑表达',
  coding_ability: '代码能力',
  ...Object.fromEntries(FEEDBACK_DIMENSIONS.map((d) => [d.key, d.short])),
};
export default function ProfileOverview() {
  const [job, setJob] = useState('');
  const load = useCallback(async (signal: AbortSignal) => {
    const page = await interviewsApi.list('?limit=20', signal);
    const completed = page.items.filter((i) => i.status === 'completed' && !i.parent_interview_id);
    const results = await Promise.allSettled(
      completed.map(async (interview) => ({
        interview,
        report: await interviewsApi.report(interview.id, signal),
      })),
    );
    return {
      entries: results.flatMap((v) => (v.status === 'fulfilled' ? [v.value] : [])),
      failed: results.filter((v) => v.status === 'rejected').length,
    };
  }, []);
  const resource = useLiveResource(load, () => false);
  const { entries = [], failed = 0 } = resource.value ?? {};
  const selectedJob = entries.some((e) => e.interview.configuration.job === job)
    ? job
    : (entries[0]?.interview.configuration.job ?? '');
  const summary = summarizePerformance(
    entries.filter((e) => e.interview.configuration.job === selectedJob).map((e) => e.report),
  );
  const observed = summary.dimensions
    .filter((d) => d.score !== null)
    .sort((a, b) => b.score! - a.score!);
  const highest = observed[0],
    lowest = observed.at(-1);
  const distinct = highest && lowest && highest.score !== lowest.score;
  const strengthSource = highest && [...highest.sources].sort((a, b) => b.score - a.score)[0];
  return (
    <section className="performance-profile">
      <header className="personal-page-header">
        <div>
          <h1>成长画像</h1>
          <p>按岗位回看多次练习，找到下一次的重点。</p>
        </div>
        <span className="workspace-page-symbol">
          <ChartNoAxesCombined size={30} />
        </span>
      </header>
      <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
      {!resource.value && !resource.error && <Loading />}
      {resource.value && (
        <>
          {entries.length > 0 && (
            <div className="profile-toolbar">
              <label className="profile-filter">
                <span>岗位方向</span>
                <select value={selectedJob} onChange={(e) => setJob(e.target.value)}>
                  {Array.from(
                    new Map(
                      entries.map((e) => [e.interview.configuration.job, e.interview.job_title]),
                    ).entries(),
                  ).map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              {observed.length > 0 && (
                <span className="profile-sample-count">{summary.count} 场有效练习</span>
              )}
            </div>
          )}
          {failed > 0 && (
            <div className="profile-load-notice" role="status">
              <span>{failed} 份报告暂未读取，画像仅使用已就绪结果。</span>
              <Button variant="ghost" size="sm" onClick={() => void resource.refresh()}>
                重新读取
              </Button>
            </div>
          )}
          {!observed.length ? (
            <div className="workspace-empty-state">
              <span className="workspace-empty-symbol">
                <ChartNoAxesCombined size={42} />
              </span>
              <h2>{entries.length ? '本岗位的画像尚未就绪' : '从一场面试，积累第一份画像'}</h2>
              <p>
                {entries.length
                  ? '可以先回看已有报告，或完成下一场练习。'
                  : '完成面试后，在这里比较同一岗位的表现变化。'}
              </p>
              <Button asChild>
                <Link
                  href={
                    entries.length
                      ? `/reports/${entries.find((e) => e.interview.configuration.job === selectedJob)!.interview.id}`
                      : '/interview/setup'
                  }
                >
                  {entries.length ? '查看最近报告' : '开始模拟面试'}
                  <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="profile-analysis-layout">
                <section className="library-panel profile-score-panel">
                  <h2>能力表现</h2>
                  <div className="profile-score-rows">
                    {summary.dimensions
                      .filter((d) => d.score !== null)
                      .map((d) => (
                        <article key={d.key}>
                          <div>
                            <strong>{labels[d.key]}</strong>
                            <span>
                              {Math.round(d.score!)}
                              <small> / 100</small>
                            </span>
                          </div>
                          <meter min={0} max={100} value={d.score!} aria-label={labels[d.key]} />
                        </article>
                      ))}
                  </div>
                </section>
                <section className="library-panel profile-focus-panel">
                  <div className="section-title-row">
                    <h2>下一次怎么练</h2>
                    <Target size={22} />
                  </div>
                  {distinct && highest.score! > 0 && (
                    <article>
                      <span>相对较好 · 一次练习中的表现</span>
                      <h3>{labels[highest.key]}</h3>
                      <p>{strengthSource?.explanation}</p>
                      <Link href={'/reports/' + strengthSource?.interview_id}>
                        回看这场报告 <ArrowUpRight size={16} />
                      </Link>
                    </article>
                  )}
                  <article>
                    <span>练习重点</span>
                    <h3>{distinct ? labels[lowest.key] : '把具体回答讲完整'}</h3>
                    <p>
                      {distinct
                        ? lowest.sources[0]?.explanation
                        : highest.score === 0
                          ? '先选择一个熟悉的问题，说明你的做法、原因和结果，再观察能力表现。'
                          : '当前维度得分接近，再用一场练习观察变化。'}
                    </p>
                    <Button variant="outline" asChild>
                      <Link href={'/interview/setup?job=' + encodeURIComponent(selectedJob)}>
                        按这个岗位再练一次
                        <ArrowRight size={16} />
                      </Link>
                    </Button>
                  </article>
                </section>
              </div>
              <p className="profile-note">
                基于最近 20 条记录中，同岗位、同评分标准的完整面试；单题重练单独保留轨迹。
                {summary.excluded > 0 ? `另有 ${summary.excluded} 份不同版本报告未合并。` : ''}
                评分仅供练习参考。
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
