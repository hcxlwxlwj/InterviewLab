import type {
  InterviewTurn,
  InterviewSnapshot,
  InterviewEvaluation,
  InterviewEvidence,
} from './live-interview';
import type { DimensionKey } from './domain/interview';

export const FRONTEND_RUBRIC_VERSION = 'frontend-internship-bars-v1';
export const REPORT_RUBRIC = {
  version: FRONTEND_RUBRIC_VERSION,
  title: '前端实习岗位 · 行为锚定评分草案',
  review_status: 'draft' as const,
  calibration_status: 'not_validated' as const,
  scope: '前端实习岗位的文字回答及语音转写；不评声音、情绪、人格或招聘适配结论。',
  methods: [
    {
      name: 'OPM 结构化面试',
      role: '借鉴岗位能力、问题与统一评价规则的对应方法。',
      url: 'https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/',
    },
    {
      name: 'BARS 行为锚定',
      role: '使用本平台编写的可观察行为档位；未获专家审核或效度验证。',
      url: 'https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/guide.pdf',
    },
    {
      name: 'SFIA',
      role: '仅辅助梳理软件能力与责任范围，不把 SFIA 等级换算为分数。',
      url: 'https://sfia-online.org/en/sfia-9/skills/programming-software-development',
    },
    {
      name: 'O*NET',
      role: '仅作后续岗位扩展参考，不作为当前评分依据。',
      url: 'https://www.onetonline.org/link/summary/15-1254.00',
    },
  ],
  rules: [
    '仅评价本题明确询问的指标；未问、未作答、拒绝披露或证据不足标为未观察，不补零。',
    '0 档必须有明确偏题、关键错误或与题意矛盾的原文证据；没有商业上线或实习经历不构成扣分理由。',
    '项目事实仅为本人陈述。计划不算已完成行动；可用课程、小型项目或个人练习说明能力。',
    'STAR 只用于组织回答的建议，不按固定格式、字数、口音、学校或表达风格扣分。',
    '代码能力仅在有实际代码考核时评价，本版本不评分。',
    '先对同一指标的已观察回合取平均，再对维度内已观察指标等权平均；总分为已评分维度等权平均，最后四舍五入。',
    '标准为平台草案，尚未人工校准；分数只描述本场已观察表现，不用于招聘决策。',
  ],
};
export type ReportIndicatorId =
  | 'technical_accuracy'
  | 'technical_reasoning'
  | 'personal_ownership'
  | 'verification'
  | 'relevance'
  | 'structure';
export interface ReportRubricIndicator {
  id: ReportIndicatorId;
  dimension: Exclude<DimensionKey, 'coding_ability'>;
  title: string;
  applies_when: string;
  anchors: readonly [string, string, string, string, string];
  example: { question: string; answer: string; level: 0 | 1 | 2 | 3 | 4; explanation: string };
}
export const REPORT_INDICATORS: readonly ReportRubricIndicator[] = [
  {
    id: 'technical_accuracy',
    dimension: 'technical_knowledge',
    title: '专业原理与正确性',
    applies_when: '技术题明确询问原理或实现，且有对应的封存专业参考。',
    anchors: [
      '原文明确包含与本题核心原理矛盾的关键判断，且可由对应专业参考核对。',
      '回应相关术语，但未说明题目所问的核心机制，或解释有关键缺口。',
      '主要结论基本成立，能解释核心机制，但细节或适用条件仍有缺口。',
      '解释准确，能结合本题情境说明机制及主要限制。',
      '在题目要求内解释充分，能区分容易混淆的条件或反例；不要求超纲知识。',
    ],
    example: {
      question: '为什么 await 后能取得 Promise 的结果？',
      answer:
        'await 会等待该 Promise 的兑现值；当前异步函数在等待期间暂停，不会阻塞整个事件循环。拒绝需要通过 try/catch 等方式处理。',
      level: 3,
      explanation: '解释了核心机制及异常边界；该示例仅用于说明锚点，不是校准样本。',
    },
  },
  {
    id: 'technical_reasoning',
    dimension: 'technical_knowledge',
    title: '方案推理与取舍',
    applies_when: '技术或业务题明确要求原因、方案比较、适用条件或取舍，且有对应专业参考。',
    anchors: [
      '给出的主要理由与题目约束直接矛盾，或明确得出不成立的因果结论。',
      '只报方案名称或个人偏好，未回应题目要求的选择理由。',
      '说明一种相关理由，但未充分连接本题约束或主要代价。',
      '结合本题约束说明方案选择和主要代价，论据与结论相连。',
      '在题目范围内比较可行替代方案，解释适用边界及验证选择的方式。',
    ],
    example: {
      question: '列表什么时候适合虚拟滚动？为什么？',
      answer:
        '列表很长且 DOM 数量影响性能时可只渲染可视区域；需要处理动态行高、定位和无障碍问题，先测量瓶颈再决定。',
      level: 3,
      explanation: '连接了选择条件与主要代价，未要求已有商业项目。',
    },
  },
  {
    id: 'personal_ownership',
    dimension: 'project_communication',
    title: '个人职责与行动',
    applies_when: '项目或经历题明确询问本人贡献、职责或具体处理过程；自我介绍不要求展开。',
    anchors: [
      '回答明确与所问本人职责无关，且经本题范围内说明仍未回应；不能因没有经历判零。',
      '主要描述团队做了什么，个人职责和行动不清楚。',
      '说明个人负责的工作，但具体行动或与团队的边界较模糊。',
      '讲清本人职责、具体行动及选择理由，区分个人与团队工作。',
      '进一步说明协作边界、行动影响和反思；无需带人、商业规模或额外头衔。',
    ],
    example: {
      question: '详情页首屏优化中，你具体负责什么？',
      answer:
        '我负责检查首屏图片请求和修改图片加载策略；接口改造由同学完成。我用浏览器网络面板定位大图后，调整尺寸并让非首屏图片延后加载。',
      level: 3,
      explanation: '职责、边界和行动具体；题目未要求结果时不因缺少收益数字扣分。',
    },
  },
  {
    id: 'verification',
    dimension: 'project_communication',
    title: '结果验证与局限',
    applies_when: '项目题明确追问结果、如何验证、测试、对比或复盘；不从一般职责题推定必答。',
    anchors: [
      '回答所述验证明显不能支持其声称的结论，且存在明确矛盾证据。',
      '只说完成或效果好，没有回应题目要求的验证方式。',
      '说明测试或观察方法，但对照条件、结果解释或局限不足。',
      '说明本人实际采用的验证方式、观察结果及主要限制，区分事实和计划。',
      '进一步解释误差、替代解释或可复现条件，并据此调整结论。',
    ],
    example: {
      question: '你如何验证首屏优化有效？',
      answer:
        '在相同网络设置下比较改动前后多次加载的 LCP，并保留网络面板记录。测试只覆盖本机和这组页面，不能代表所有用户。',
      level: 3,
      explanation: '方法、对比条件与局限明确，不要求虚构业务指标。',
    },
  },
  {
    id: 'relevance',
    dimension: 'logical_expression',
    title: '切题与范围',
    applies_when: '本题有可分析的有效回答；只判断明确问题范围，不扩张要求。',
    anchors: [
      '原文主要内容明确偏离所问主题，无法回应核心问题。',
      '涉及相关话题，但没有回应核心要求。',
      '回应了核心问题，但重点或所问内容覆盖仍有明显缺口。',
      '直接回应问题主要要求，重点清楚，事实与未知内容有区分。',
      '回应完整且范围控制清楚，必要时主动说明歧义、约束或不能确认的内容。',
    ],
    example: {
      question: '请简要介绍学习背景及想做前端的原因。',
      answer:
        '我是软件工程专业学生，做过课程网页项目。实现可交互界面让我更有兴趣，因此希望继续学习前端工程。',
      level: 3,
      explanation: '直接回应背景与动机，不以学校名气或经历规模评价。',
    },
  },
  {
    id: 'structure',
    dimension: 'logical_expression',
    title: '组织与论据连接',
    applies_when: '回答包含可判断的观点与说明；过短、保密拒答或纯澄清不强行评分。',
    anchors: [
      '回答内部有明确自相矛盾的关键陈述，导致主要观点无法理解。',
      '信息零散，主要观点和支持材料的关系难以辨认。',
      '能理解主要观点，但说明顺序或论据连接仍有明显跳跃。',
      '表达顺序清楚，主要观点有相关解释或实例支持。',
      '在题目范围内层次清楚，明确区分事实、推断与局限；不要求使用 STAR 格式。',
    ],
    example: {
      question: '你如何定位页面变慢的原因？',
      answer:
        '我先区分网络请求慢还是渲染慢，再用网络面板和 Performance 记录验证。确认瓶颈后只改一项并复测，避免把相关性当因果。',
      level: 3,
      explanation: '说明顺序与验证关系清楚；口语化表达不扣分。',
    },
  },
];

export interface ReportIndicatorAssessment {
  indicator_id: ReportIndicatorId;
  status: 'scored' | 'not_observed';
  level: 0 | 1 | 2 | 3 | 4 | null;
  text: string;
  evidence_refs: InterviewEvidence[];
}

/** Applicability is decided from the question and frozen reference, never from a fluent answer. */
export function applicableReportIndicators(
  turn: InterviewTurn,
  snapshot: InterviewSnapshot,
): ReportRubricIndicator[] {
  const question = turn.text;
  const reference = snapshot.knowledge.questions.some(
    (q) =>
      (q.id === turn.knowledge_question_id || q.topic === turn.topic) &&
      q.report_reference?.cards.length,
  );
  return REPORT_INDICATORS.filter((i) => {
    if (i.id === 'relevance' || i.id === 'structure') return true;
    if (turn.stage === 'introduction') return false;
    if (i.id === 'personal_ownership')
      return (
        /负责|职责|贡献|你(?:具体)?做了|本人|你如何|你怎么/.test(question) &&
        turn.stage === 'experience'
      );
    if (i.id === 'verification')
      return (
        turn.stage === 'experience' && /验证|测试|结果|效果|指标|对比|复盘|证明|衡量/.test(question)
      );
    if (i.id === 'technical_accuracy') return reference && turn.stage === 'technical';
    return (
      reference &&
      ['technical', 'business'].includes(turn.stage ?? '') &&
      /为什么|为何|原因|取舍|选择|比较|对比|权衡|适合|方案|设计/.test(question)
    );
  });
}

/** Equal indicators within dimensions; repeated follow-ups do not increase an indicator's weight. */
export function aggregateIndicatorScores(evaluations: InterviewEvaluation[]) {
  return REPORT_INDICATORS.flatMap((indicator) => {
    const ratings = evaluations
      .filter((e) => e.scoring_rubric_version === FRONTEND_RUBRIC_VERSION)
      .flatMap((e) =>
        (e.indicator_assessments ?? []).filter(
          (a) =>
            a.indicator_id === indicator.id &&
            a.status === 'scored' &&
            a.level !== null &&
            Number.isInteger(a.level) &&
            a.level >= 0 &&
            a.level <= 4 &&
            a.evidence_refs.length,
        ),
      );
    if (!ratings.length) return [];
    return [
      {
        ...indicator,
        score: ratings.reduce((sum, a) => sum + a.level! * 25, 0) / ratings.length,
        evidence_refs: ratings.flatMap((a) => a.evidence_refs),
        observations: ratings.length,
      },
    ];
  });
}
