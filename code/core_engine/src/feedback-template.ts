import type { InterviewEvidence, InterviewReportSummary } from './live-interview';

/** Source: 面试反馈模板.xlsx / 维度评分表 A2:F7. Percent scores are weighted in code. */
export const FEEDBACK_TEMPLATE_VERSION = 'interview-feedback-v1';
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
      '动机模糊，方向不匹配',
      '目标一般，匹配度中等',
      '兴趣明确，经历相关',
      '目标清晰，主动了解岗位并规划',
    ],
  },
  {
    key: 'learning_initiative',
    label: '综合素质（主动/抗压/稳定）',
    short: '综合素质',
    weight: 5,
    anchors: [
      '态度浮躁或回避问题',
      '中规中矩，缺乏主动',
      '学习意愿强，抗压好',
      '主动反思、乐于补短板',
    ],
  },
] as const;
export type FeedbackDimensionKey = (typeof FEEDBACK_DIMENSIONS)[number]['key'];
export interface FeedbackAssessment {
  dimension: FeedbackDimensionKey;
  score: number | null;
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
export function feedbackScore(feedback: InterviewReportSummary['feedback_template']) {
  const scored = FEEDBACK_DIMENSIONS.flatMap((d) => {
    const a = feedback?.assessments.find((a) => a.dimension === d.key);
    return a && a.score !== null && a.evidence_refs.length
      ? [{ weight: d.weight, score: a.score }]
      : [];
  });
  const coverage = scored.reduce((sum, d) => sum + d.weight, 0);
  // Normalize only observed weights; consumers must display coverage for partial reports.
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
