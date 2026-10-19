import type {
  Configuration,
  DimensionKey,
  InterviewType,
  Preferences,
  SessionStatus,
} from './domain/interview';
export const TYPE_LABELS: Record<InterviewType, string> = {
  project_deep_dive: '项目深挖',
  technical_qa: '专业问答',
  hr: 'HR 面试',
  mixed: '综合面试',
};
export const STATUS_LABELS: Record<SessionStatus, string> = {
  draft: '配置中',
  ready: '待开始',
  in_progress: '进行中',
  paused: '已暂停',
  ending: '正在结束',
  completed: '已完成',
  failed: '已中断',
};
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  technical_knowledge: '专业知识',
  project_communication: '项目表达',
  coding_ability: '代码能力',
  logical_expression: '逻辑表达',
};
export const DEFAULT_PREFERENCES: Preferences = {
  interaction_mode: 'realtime_voice',
  editor_theme: 'system',
  default_job_direction: '',
  version: 1,
};
export function defaultConfiguration(job = 'frontend'): Configuration {
  return {
    job,
    interview_type: 'project_deep_dive',
    difficulty: '基础',
    jd_text: '',
    duration_minutes: 10,
    interviewer_style: '标准',
    code_assessment_enabled: false,
    interaction_mode: 'realtime_voice',
    camera_enabled: false,
    review_media_enabled: false,
    resume_document_id: 'resume-frontend',
    focus_experience_ids: ['exp-market'],
  };
}
