'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { InterviewTurn } from '@interviewlab/core';

export function ReviewConversationTurn({
  turn,
  score,
  children,
}: {
  turn: InterviewTurn;
  score?: number;
  children: ReactNode;
}) {
  return (
    <article
      className="review-conversation-turn"
      id={`turn-${turn.id}`}
      aria-label={`第${turn.main_question_index}题${turn.follow_up_index ? `追问${turn.follow_up_index}` : ''}`}
    >
      <div className="review-turn-divider">
        <span>
          第 {turn.main_question_index} 题
          {turn.follow_up_index ? ` · 追问 ${turn.follow_up_index}` : ''}
        </span>
      </div>
      <div className="review-message review-message-interviewer">
        <span className="review-avatar" aria-hidden="true">
          面
        </span>
        <div className="review-message-content">
          <span className="review-speaker">面试官</span>
          <div className="review-bubble">{turn.text}</div>
        </div>
      </div>
      <div className="review-message review-message-candidate">
        <span className="review-avatar" aria-hidden="true">
          我
        </span>
        <div className="review-message-content">
          <span className="review-speaker">你的回答</span>
          <div
            className={`review-bubble ${turn.answer_status === 'answered' ? '' : 'review-bubble-empty'}`}
          >
            {turn.answer_status === 'answered'
              ? turn.answer_text
              : turn.answer_status === 'skipped'
                ? '已跳过这道题'
                : '这道题未提交回答'}
          </div>
        </div>
      </div>
      {turn.answer_status === 'answered' && (
        <details className="review-turn-analysis" data-turn-analysis>
          <summary>
            <span>
              {score !== undefined ? (
                <>
                  <strong>{Math.round(score)}</strong>
                  <small> / 100 · 本题得分</small>
                </>
              ) : (
                '本题复盘'
              )}
            </span>
            <span className="review-expand-label">
              <span className="review-label-closed">展开分析</span>
              <span className="review-label-open">收起分析</span>
              <ChevronDown size={15} />
            </span>
          </summary>
          <div className="review-analysis-content">{children}</div>
        </details>
      )}
    </article>
  );
}
