import type { InterviewEvidence, InterviewReportSummary } from './live-interview';

/** Source: 面试反馈模板.xlsx / 维度评分表 A2:F7. Percent scores are weighted in code. */
export const FEEDBACK_TEMPLATE_VERSION = 'interview-feedback-v2';
/** New evaluations score only actual answer evidence within the question's scope. */
export const FEEDBACK_ANALYSIS_VERSION = 'text-review-v16';
export const FEEDBACK_DIMENSIONS = [
  {
    key: 'professional_foundation',
    label: '专业基础与知识深度',
    short: '专业基础',
    weight: 25,
    anchors: [
      '概念不清，多处盲区，追问即崩',
      '能答要点，深度不足，经提示可推进',
      '概念清晰，能解释原理与为什么',
      '体系完整，能横向联系并主动深挖',
    ],
  },
  {
    key: 'project_reflection',
    label: '项目理解',
    short: '项目理解',
    weight: 25,
    anchors: [
      '讲不清项目，职责与结果模糊',
      '能复述过程，缺量化与反思',
      '复盘清晰，有量化指标与取舍',
      '能讲清决策依据、教训与可改进点',
    ],
  },
  {
    key: 'problem_solving',
    label: '逻辑思维',
    short: '逻辑思维',
    weight: 25,
    anchors: [
      '答非所问，结构混乱',
      '有思路但发散，抓不住重点',
      '分层拆解，结论先行',
      '能迁移类比，面对追问应变好',
    ],
  },
  {
    key: 'communication',
    label: '表达与沟通',
    short: '表达沟通',
    weight: 15,
    anchors: [
      '逻辑跳跃，术语滥用或沉默',
      '基本达意，节奏偏慢',
      '条理清晰，面向听众',
      '简洁精准，善用先结论后展开',
    ],
  },
  {
    key: 'motivation',
    label: '岗位匹配度',
    short: '岗位匹配度',
    weight: 5,
    anchors: [
      '回答体现的知识或做法与岗位要求有明确偏差',
      '体现部分岗位相关知识或实践，适用理解有限',
      '知识、职责或解决问题的方式与岗位要求相关',
      '能结合岗位目标与约束说明选择、验证和改进',
    ],
  },
  {
    key: 'learning_initiative',
    label: '综合素质（学习与反思）',
    short: '综合素质',
    weight: 5,
    anchors: [
      '对已讨论的问题未能解释学习或调整方法',
      '能说明学习、协作或改进的基本做法',
      '能识别不足并主动验证或调整做法',
      '能结合反馈复盘并提出可验证的改进行动',
    ],
  },
] as const;
export type FeedbackDimensionKey = (typeof FEEDBACK_DIMENSIONS)[number]['key'];
export interface FeedbackAssessment {
  dimension: FeedbackDimensionKey;
  score: number;
  text: string;
  evidence_refs: InterviewEvidence[];
}
/** A missing score is an observation boundary, never a zero score. */
export interface FeedbackObservation {
  dimension: FeedbackDimensionKey;
  status: 'observed' | 'not_observed' | 'insufficient_evidence';
  text: string;
  evidence_refs: InterviewEvidence[];
}
export interface FeedbackTemplate {
  version: typeof FEEDBACK_TEMPLATE_VERSION;
  assessments: FeedbackAssessment[];
  action_plan: {
    horizon: 'short_term' | 'medium_term' | 'long_term';
    turn_id: string;
    action: string;
    acceptance: string;
  }[];
  next_expectation: string;
}
export function feedbackScore(feedback: InterviewReportSummary['feedback_template'] | undefined) {
  const scored = FEEDBACK_DIMENSIONS.flatMap((d) => {
    const a = feedback?.assessments.find((a) => a.dimension === d.key);
    return a ? [{ weight: d.weight, score: a.score }] : [];
  });
  const coverage = scored.reduce((sum, d) => sum + d.weight, 0);
  // Omitted HR dimensions carry no weight; recorded zero scores remain real scores.
  return {
    coverage,
    score:
      coverage > 0
        ? Math.round(scored.reduce((sum, d) => sum + d.score * d.weight, 0) / coverage)
        : null,
  };
}

/** Question coverage guides interviewing; it is never converted into a numerical score. */
export const FEEDBACK_INTERVIEW_GOALS = {
  professional_foundation: ['understanding', 'verification'],
  project_reflection: ['contribution'],
  problem_solving: ['tradeoffs', 'business'],
  communication: [],
  motivation: ['motivation'],
  learning_initiative: ['learning', 'collaboration'],
} as const;
export function missingFeedbackDimensions(
  memory: import('./interview-agent').InterviewMemory | null,
  hasAnswer: boolean,
) {
  return FEEDBACK_DIMENSIONS.filter((d) =>
    d.key === 'communication'
      ? !hasAnswer
      : !memory?.observations.some(
          (o) =>
            (FEEDBACK_INTERVIEW_GOALS[d.key] as readonly string[]).includes(o.goal) &&
            ['covered', 'inconclusive'].includes(o.state) &&
            o.evidence_refs.length > 0,
        ),
  );
}
