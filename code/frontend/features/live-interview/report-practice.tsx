'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  isQuestionScoringVersion,
  type Interview,
  type InterviewEvaluation,
  type InterviewFinding,
  type InterviewReport,
  type InterviewTurn,
} from '@interviewlab/core';
import { Button } from '../../components/ui/button';
import { IndicatorRatings } from './report-standard';
import { QuestionScorecard, PracticeHistory } from './question-scores';
import { ReviewConversationTurn } from './review-conversation';
import { reviewAdvice } from './review-advice';
import { isReportPending } from './report-progress';

export type StartReportPractice = (
  interviewId: string,
  input: { turn_id: string; revision: number; goal: string },
) => void;

function Findings({ items }: { items: InterviewFinding[] }) {
  return (
    <>
      {items.map((finding, i) => (
        <div key={i}>
          <p>{finding.text}</p>
        </div>
      ))}
    </>
  );
}

function EvaluationAdvice({ evaluation }: { evaluation: InterviewEvaluation }) {
  const advice = reviewAdvice(evaluation);
  return advice.length ? (
    <section className="review-training-goal">
      <h3>改进建议</h3>
      {advice.map((text, index) => (
        <p key={index}>{text}</p>
      ))}
    </section>
  ) : null;
}

function PracticeResultScore({ report }: { report: InterviewReport }) {
  const score = report.question_scores?.[0];
  if (score) return <QuestionScorecard score={score.score} assessments={score.assessments} />;
  return (
    <p role="status">
      {isReportPending(report)
        ? '本题评分生成中…'
        : report.status === 'failed'
          ? '本题评分失败，回答已保留。'
          : isQuestionScoringVersion(report.question_scoring_version)
            ? '本次回答暂无能力评分。'
            : '历史练习没有本版评分。'}
    </p>
  );
}

export function PracticeResult({
  interview,
  report,
  busy,
  retryScore,
  startPractice,
  notice,
}: {
  interview: Interview;
  report: InterviewReport;
  busy: boolean;
  retryScore: () => void;
  startPractice: StartReportPractice;
  notice: ReactNode;
}) {
  const evaluation = report.evaluations.at(-1);
  const parentId = interview.parent_interview_id!;
  return (
    <>
      <section className="panel">
        <h1>单题重练结果</h1>
        <p>{interview.turns[0]?.text}</p>
        <Link href={`/reports/${parentId}/practice`}>返回原面试逐题复盘</Link>
        <PracticeResultScore report={report} />
        {report.status === 'failed' || report.analysis_progress?.failed ? (
          <button className="live-button" disabled={busy} onClick={retryScore}>
            重试本题评分
          </button>
        ) : null}
        {evaluation && (
          <>
            <h3>做得好的地方</h3>
            <Findings items={evaluation.strengths} />
            <EvaluationAdvice evaluation={evaluation} />
            {report.advice_status === 'failed' && <p>个性化建议暂不可用，本题评分已保留。</p>}
          </>
        )}
        <section className="review-saved-answer">
          <h3>本次回答</h3>
          {interview.turns.map((turn) => (
            <p key={turn.id}>{turn.answer_text}</p>
          ))}
        </section>
        <button
          className="live-button"
          disabled={busy}
          onClick={() =>
            startPractice(parentId, {
              turn_id: interview.parent_turn_id!,
              revision: interview.parent_revision!,
              goal: interview.retry_goal ?? '围绕原题补充具体依据',
            })
          }
        >
          再次重练本题
        </button>
        {notice}
      </section>
      <section className="panel">
        <PracticeHistory
          report={report}
          turnIds={interview.parent_turn_id ? [interview.parent_turn_id] : undefined}
          originalId={parentId}
        />
      </section>
    </>
  );
}

function TurnEvaluation({
  evaluation,
  hasQuestionScore,
}: {
  evaluation: InterviewEvaluation;
  hasQuestionScore: boolean;
}) {
  return (
    <>
      {!hasQuestionScore && <IndicatorRatings evaluation={evaluation} />}
      {!!evaluation.strengths.length && (
        <section className="review-feedback-section">
          <h3>亮点</h3>
          <Findings items={evaluation.strengths} />
        </section>
      )}
      <EvaluationAdvice evaluation={evaluation} />
    </>
  );
}

function MissingTurnEvaluation({ turnId, report }: { turnId: string; report: InterviewReport }) {
  return (
    <p>
      {isReportPending(report)
        ? '本题分析正在生成。'
        : report.missing_turn_ids.includes(turnId)
          ? '本题分析生成失败，原回答已保留。'
          : '本题分析尚未完成。'}
    </p>
  );
}

export function PracticeReportTurn({
  id,
  turn,
  report,
  busy,
  startPractice,
}: {
  id: string;
  turn: InterviewTurn;
  report: InterviewReport;
  busy: boolean;
  startPractice: StartReportPractice;
}) {
  if (turn.answer_status !== 'answered')
    return <ReviewConversationTurn turn={turn}>{null}</ReviewConversationTurn>;
  const questionScore = report.question_scores?.find((score) => score.turn_ids.includes(turn.id));
  const evaluation = report.evaluations.find(
    (item) => item.turn_id === turn.id && item.revision === turn.revision,
  );
  const isScoredTurn = questionScore?.turn_id === turn.id;
  return (
    <ReviewConversationTurn turn={turn} score={isScoredTurn ? questionScore.score : undefined}>
      {questionScore && isScoredTurn && (
        <>
          <QuestionScorecard score={questionScore.score} assessments={questionScore.assessments} />
          <section className="review-history">
            <PracticeHistory report={report} turnIds={questionScore.turn_ids} originalId={id} />
          </section>
        </>
      )}
      {evaluation ? (
        <TurnEvaluation evaluation={evaluation} hasQuestionScore={Boolean(questionScore)} />
      ) : (
        <MissingTurnEvaluation turnId={turn.id} report={report} />
      )}
      {(turn.follow_up_index === 0 || isScoredTurn) && (
        <button
          className="live-button secondary"
          disabled={busy}
          onClick={() =>
            startPractice(id, {
              turn_id: turn.id,
              revision: turn.revision,
              goal: evaluation?.retry_goal ?? '围绕原题补充本人行动及验证依据',
            })
          }
        >
          重练这一题
        </button>
      )}
    </ReviewConversationTurn>
  );
}

export function PracticeReportPage({
  id,
  interview,
  report,
  busy,
  startPractice,
  onSelect,
  notice,
}: {
  id: string;
  interview: Interview;
  report: InterviewReport;
  busy: boolean;
  startPractice: StartReportPractice;
  onSelect: (turnId: string) => void;
  notice: ReactNode;
}) {
  return (
    <section className="report-practice-page">
      <div className="report-dialog-heading">
        <div>
          <h1>逐题复盘与重练</h1>
          <p>回看这场对话，展开每题分析，再选择需要练习的地方。</p>
        </div>
        <Link className="live-button secondary" href={`/reports/${id}`}>
          面试报告
        </Link>
      </div>
      {notice}
      {isReportPending(report) && (
        <p className="notice" role="status">
          逐题分析正在生成，已完成的评分和原回答可先查看。
        </p>
      )}
      <section className="report-detail">
        <div id="review-panel">
          <div className="turn-reviews">
            <nav className="review-question-index" aria-label="按主问题浏览">
              {interview.turns
                .filter((turn) => !turn.follow_up_index)
                .map((turn) => (
                  <a key={turn.id} href={`#turn-${turn.id}`} onClick={() => onSelect(turn.id)}>
                    第 {turn.main_question_index} 题
                  </a>
                ))}
            </nav>
            {interview.turns.map((turn) => (
              <PracticeReportTurn
                key={turn.id}
                id={id}
                turn={turn}
                report={report}
                busy={busy}
                startPractice={startPractice}
              />
            ))}
          </div>
        </div>
      </section>
      <div className="report-dialog-footer">
        {' '}
        <Button size="sm" asChild>
          <Link href={`/interview/setup?job=${encodeURIComponent(interview.configuration.job)}`}>
            <RotateCcw size={14} />
            重新面试
          </Link>
        </Button>
      </div>
    </section>
  );
}
