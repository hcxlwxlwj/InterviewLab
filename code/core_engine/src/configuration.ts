import type { SessionStatus, DimensionKey } from './domain/interview';
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
