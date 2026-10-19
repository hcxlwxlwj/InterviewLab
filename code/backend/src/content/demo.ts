/** Synthetic fixtures for the local prototype, never real personal records. */
import {
  buildQuestions,
  commitAnswer,
  defaultConfiguration,
  finishSession,
  overallScore,
  type Dimension,
  type DimensionKey,
  type Experience,
  type Report,
  type ResumeDocument,
  type Session,
} from '@interviewlab/core';
import { getJob } from './index';
export const RESUMES: ResumeDocument[] = [
  {
    id: 'resume-frontend',
    name: '前端项目版',
    version: 1,
    is_default: true,
    storage_scope: 'library',
    parse_status: 'confirmed',
    file_type: 'pdf',
    created_at: '2026-10-15T08:00:00Z',
  },
  {
    id: 'resume-backend',
    name: '后端实习版',
    version: 2,
    is_default: false,
    storage_scope: 'library',
    parse_status: 'confirmed',
    file_type: 'pdf',
    created_at: '2026-10-16T08:00:00Z',
  },
];
export const EXPERIENCES: Experience[] = [
  {
    id: 'exp-market',
    title: '校园二手交易平台',
    kind: 'course_project',
    personal_role: '前端页面与交互开发',
    actions: '负责商品列表、搜索筛选和发布表单，与同学约定接口字段。',
    technical_decisions: '使用组件拆分复用筛选逻辑，区分服务端数据和表单状态。',
    results: '完成课程演示，并通过手工场景检查核心流程。',
    confirmed: true,
    version: 1,
    resume_document_id: 'resume-frontend',
  },
  {
    id: 'exp-schedule',
    title: '课程管理系统',
    kind: 'course_project',
    personal_role: '课表交互实现',
    actions: '实现课程筛选、时间冲突提示和空态。',
    technical_decisions: '将时间段归一后判断重叠。',
    results: '交付小组课程项目。',
    confirmed: true,
    version: 1,
    resume_document_id: 'resume-frontend',
  },
  {
    id: 'exp-library',
    title: '图书借阅管理系统',
    kind: 'course_project',
    personal_role: '借阅接口与数据库设计',
    actions: '编写借还书接口、设计借阅记录表并处理重复请求。',
    technical_decisions: '以事务保证库存更新与借阅记录一致。',
    results: '用正常与重复借阅场景验证接口。',
    confirmed: true,
    version: 1,
    resume_document_id: 'resume-backend',
  },
];
export function sampleSession(): Session {
  const configuration = { ...defaultConfiguration(), interaction_mode: 'text_fallback' as const };
  const questions = buildQuestions(configuration, getJob(configuration.job));
  const answers = [
    '这是一个小组课程项目。我主要负责商品列表、搜索筛选和发布表单，后端接口由另一位同学负责。我们先约定了接口字段，再拆分组件，最后用几组商品数据验证了筛选和发布流程。',
    '商品列表和发布表单由我独立实现。接口字段和错误提示是与后端同学一起讨论确定的。',
    '最初我们将筛选条件分别存储在多个组件里，切换页面后会出现不同步。我把条件收敛到页面状态，通过参数传给子组件，减少了重复状态。',
  ];
  const base: Session = {
    id: 'sample-interview',
    mode: 'mock',
    interview_type: configuration.interview_type,
    status: 'in_progress',
    configuration,
    version: 1,
    created_at: '2026-10-18T06:00:00Z',
    started_at: '2026-10-18T06:00:00Z',
    questions,
    turns: [],
    material_snapshot: { resume: RESUMES[0], experiences: [EXPERIENCES[0]] },
    is_sample: true,
  };
  let session = base;
  answers.forEach((a, i) => {
    session = commitAnswer(
      session,
      a,
      'answer',
      `sample-submission-${i}`,
      Date.parse(base.started_at) + (i + 1) * 60000,
    );
  });
  return { ...finishSession(session, Date.parse(base.started_at) + 326000), report_ready_at: 0 };
}

export function reportFor(session: Session, now = Date.now()): Report {
  const empty = (): Dimension => ({
    status: 'not_observed',
    score: null,
    explanation: '当前为交互演示，未接入专业评估服务。',
    evidence_refs: [],
  });
  const dimensions: Record<DimensionKey, Dimension> = {
    technical_knowledge: empty(),
    project_communication: empty(),
    coding_ability: empty(),
    logical_expression: empty(),
  };
  if (session.is_sample) {
    const evidence = [
      {
        turn_id: session.turns[0].id,
        revision: 1,
        quote: '我主要负责商品列表、搜索筛选和发布表单',
      },
    ];
    dimensions.technical_knowledge = {
      status: 'observed',
      score: 78,
      explanation: '示例：交代了组件划分与状态管理的基本思路。',
      evidence_refs: evidence,
    };
    dimensions.project_communication = {
      status: 'observed',
      score: 85,
      explanation: '示例：区分了本人负责的模块和同学完成的工作。',
      evidence_refs: evidence,
    };
    dimensions.logical_expression = {
      status: 'observed',
      score: 80,
      explanation: '示例：先概述职责，再描述具体行动，验证过程仍可补充。',
      evidence_refs: evidence,
    };
    dimensions.coding_ability.explanation = '本场未安排正式代码考核。';
  }
  const valid = session.turns.filter((t) => t.action === 'answer' && t.answer_text.trim()).length;
  return {
    id: `report-${session.id}`,
    session_id: session.id,
    status:
      session.status !== 'completed' && session.status !== 'failed'
        ? 'pending'
        : now < (session.report_ready_at ?? 0)
          ? 'generating'
          : 'ready',
    overall_score: valid ? overallScore(dimensions) : null,
    dimensions,
    is_partial: session.status === 'failed',
    is_sample: session.is_sample,
    coverage: valid
      ? `已记录 ${valid} 次回答，${session.turns.filter((t) => t.action === 'skip').length} 次跳过`
      : '没有已提交的有效回答，本场不评分',
  };
}
