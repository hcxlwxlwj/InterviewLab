import type { InterviewConfig, Interview } from './live-interview';
import type { InterviewMemory as Memory } from './interview-agent';
import { mainQuestionLimit } from './live-interview';

export const INTERVIEW_POLICY_VERSION = 'interview-policy-v3';
export const ACTIVE_INTERVIEW_TYPES = ['technical_qa', 'business_scenario', 'hr', 'mixed'] as const;
export interface InterviewTheme {
  goal: string;
  purpose: string;
  probe: string;
  stop: string;
}
const theme = (goal: string, purpose: string, probe: string): InterviewTheme => ({
  goal,
  purpose,
  probe,
  stop: '关键依据已清楚、明确不会或未参与、拒绝，或一次澄清后仍无新增信息时转场',
});
export function interviewPolicy(config: InterviewConfig) {
  const professional = [
    theme(
      'understanding',
      '目标岗位实际工作需要的基础知识与适用边界',
      '结合已学内容或实际参与的工作问一个岗位相关原理',
    ),
    theme(
      'contribution',
      '核对简历项目中的实际参与范围与本人行动',
      '仅询问本人承担的部分；没有项目可用课程、练习或作业',
    ),
    theme(
      'verification',
      '实际方法、验证依据与问题定位',
      '问如何发现或检验一个具体结果，不预设线上规模',
    ),
    theme('tradeoffs', '约束下的专业判断', '围绕真实选择问依据，不考与岗位无关的偏题'),
    theme('learning', '实践心得、反馈与改进', '问一次具体反思或后续尝试'),
    theme('motivation', '岗位理解与准备', '从岗位任务及所做准备了解匹配程度'),
  ];
  const business = [
    theme(
      'business',
      '目标岗位实际任务的目标、对象与成功标准',
      '结合岗位任务或实际项目，不统一套产品或商业收入指标',
    ),
    theme('contribution', '本人在任务中的职责与行动', '区分本人参与和团队成果，不深入其未参与部分'),
    theme('tradeoffs', '约束、优先级与决策依据', '针对一个实际冲突了解如何判断取舍'),
    theme(
      'understanding',
      '完成岗位任务所需的专业判断',
      '了解方法及适用边界，不转成代码或术语考试',
    ),
    theme('verification', '任务结果与验证', '问如何确认任务完成或发现偏差，接受非商业结果'),
    theme('learning', '协作、复盘与调整', '问得到反馈后具体调整了什么'),
    theme('motivation', '岗位任务理解与准备', '从任务认识及准备过程了解匹配程度'),
  ];
  const hr = [
    theme('motivation', '求职动机、岗位选择与准备', '了解选择依据，不追问专业实现'),
    theme(
      'availability',
      config.career_stage === 'internship'
        ? '到岗时间、每周可出勤天数与可持续实习时长'
        : '可到岗时间与工作地点意向',
      '每次问一个尚未说明的安排，允许跳过',
    ),
    theme('expectations', '薪资期望与求职关注点', '只了解期望，不编造企业待遇，不评价薪资高低'),
    theme('collaboration', '具体协作行为与职责边界', '可以结合项目，但只了解沟通行动与分工'),
    theme('learning', '学习反馈与反思', '了解一次具体调整，不追技术细节'),
  ];
  const themes =
    config.interview_type === 'hr'
      ? hr
      : config.interview_type === 'business_scenario'
        ? business
        : config.interview_type === 'mixed'
          ? [...professional, hr[1], hr[2], business[0]]
          : professional;
  return {
    version: INTERVIEW_POLICY_VERSION,
    themes,
    opening_seconds: config.duration_minutes === 5 ? 30 : 60,
    core_seconds:
      config.duration_minutes * 60 -
      (config.duration_minutes === 5 ? 90 : config.duration_minutes === 10 ? 150 : 180),
    closing_seconds: config.duration_minutes === 5 ? 60 : config.duration_minutes === 10 ? 90 : 120,
    core_theme_target:
      config.duration_minutes === 5
        ? [2, 3]
        : config.duration_minutes === 10
          ? [3, 4]
          : config.duration_minutes === 20
            ? [5, 6]
            : [6, 8],
    required_dimensions: config.interview_type !== 'hr',
    mixed_allocation:
      config.interview_type === 'mixed' ? { professional: 50, business: 30, hr: 20 } : null,
    focus:
      config.interview_type === 'hr'
        ? '求职动机与实际安排优先，有时间再展开协作反思；不考技术实现'
        : config.interview_type === 'business_scenario'
          ? '岗位实际工作判断；可讨论项目，重点是目标、约束、方法、结果与心得'
          : config.interview_type === 'mixed'
            ? '专业、业务和HR按时间组合；已展开的线索先收束，不机械轮换阶段'
            : '岗位相关知识与实际运用；通过项目核对参与、依据与心得，不只问项目介绍',
  };
}

export function interviewPacing(interview: Interview, memory: Memory | null, now = Date.now()) {
  const policy = interviewPolicy(interview.configuration);
  const last = interview.turns.at(-1);
  const remaining = interview.target_at
    ? Math.max(0, (Date.parse(interview.target_at) - now) / 1000)
    : interview.configuration.duration_minutes * 60;
  const closing = remaining <= policy.closing_seconds;
  const focus = memory?.observations?.find((o) => o.goal === memory.focus);
  const settled = focus && ['covered', 'inconclusive', 'not_applicable'].includes(focus.state);
  const act = memory?.conversation?.last_act;
  const previous = interview.turns
    .slice(0, -1)
    .filter(
      (t) => t.main_question_index === last?.main_question_index && t.answer_status === 'answered',
    )
    .at(-1);
  const repeated =
    !!last?.answer_text &&
    !!previous?.answer_text &&
    last.answer_text.replace(/\s/g, '') === previous.answer_text.replace(/\s/g, '');
  const maxFollowups = interview.configuration.interviewer_style === '深入追问' ? 2 : 1;
  const elapsedCore = Math.max(
    0,
    interview.configuration.duration_minutes * 60 - remaining - policy.opening_seconds,
  );
  const mixedFocus =
    elapsedCore >= policy.core_seconds * 0.8 ||
    (last?.main_question_index ?? 0) >=
      Math.ceil(mainQuestionLimit(interview.configuration.duration_minutes) * 0.8)
      ? 'hr'
      : elapsedCore >= policy.core_seconds * 0.5 ||
          (last?.main_question_index ?? 0) >=
            Math.ceil(mainQuestionLimit(interview.configuration.duration_minutes) * 0.6)
        ? 'business'
        : 'professional';
  return {
    remaining_seconds: Math.round(remaining),
    phase: closing ? 'closing' : 'core',
    allow_follow_up:
      !!last &&
      last.follow_up_index < maxFollowups &&
      !closing &&
      !settled &&
      !repeated &&
      act !== 'decline_topic' &&
      act !== 'dont_know',
    max_follow_ups: maxFollowups,
    preferred_goals:
      interview.configuration.interview_type === 'mixed'
        ? mixedFocus === 'hr'
          ? ['motivation', 'availability', 'expectations', 'learning', 'collaboration']
          : mixedFocus === 'business'
            ? ['business', 'tradeoffs', 'verification']
            : ['understanding', 'contribution', 'verification', 'tradeoffs']
        : policy.themes.map((t) => t.goal),
  };
}
