import type { Configuration, Question } from './domain/interview';
import type { JobTemplate } from './domain/knowledge';
export function buildQuestions(
  config: Configuration,
  template: JobTemplate | undefined,
): Question[] {
  if (!template || template.status !== 'published')
    throw new Error('岗位模板未发布或已不可用，请重新选择岗位。');
  const project = config.focus_experience_ids.length > 0;
  let texts =
    config.interview_type === 'hr'
      ? [
          '请简单介绍自己，以及你希望从这份岗位中获得什么。',
          '请分享一次你与同学意见不一致的经历。',
          '在任务很多的时候，你如何安排优先级？',
          '请描述一次你主动学习陌生知识的经历。',
          '遇到暂时无法解决的困难，你会怎么做？',
          '你还有什么想补充的吗？',
        ]
      : project
        ? [
            '请介绍一个你参与的项目，并具体说明你负责的部分。',
            '项目中遇到的一个难点是什么？你是如何定位和处理的？',
            '你如何验证自己的实现是正确的？',
            '请谈谈项目里的一次团队协作。',
            '如果重新实现这个项目，你会优先改进什么？',
            '结合目标岗位，你认为这段经历体现了哪些能力？',
          ]
        : [
            '请介绍一下你的学习经历和目标岗位。',
            `在${template.title}中，选择一个熟悉的专业概念说明其原理。`,
            '请举例说明这个概念或方法在什么场景下适用。',
            '出现异常结果时，你通常如何定位问题？',
            '你会如何设计一个验证思路的最小实验？',
            '你下一阶段希望深入学习什么？',
          ];
  const technical = template.questions.slice(0, 6).map((q) => q.text);
  if (config.difficulty !== '基础')
    technical[0] +=
      config.difficulty === '进阶'
        ? '请进一步说明其中的关键原理与边界条件。'
        : '请比较一种替代方案，并说明失败场景和取舍依据。';
  if (config.interview_type === 'technical_qa') texts = technical;
  if (config.interview_type === 'mixed')
    texts = [
      texts[0],
      texts[1],
      technical[0],
      technical[1],
      '请分享一次团队协作中需要调整自己方案的经历。',
      '结合目标岗位，你还希望补充什么？',
    ];
  const questions: Question[] = [];
  texts.forEach((text, i) => {
    const knowledge = template.questions.find((q) => text.startsWith(q.text));
    questions.push({
      id: `q-${i + 1}`,
      text,
      main_question_index: i + 1,
      follow_up_index: 0,
      knowledge_question_id: knowledge?.id,
      template_version: template.version,
      source_refs: knowledge?.source_refs ?? template.source_refs,
    });
    if (
      config.interview_type === 'technical_qa' &&
      config.interviewer_style === '深入追问' &&
      knowledge &&
      i < 2
    ) {
      knowledge.follow_ups.slice(0, 2).forEach((followUp, index) =>
        questions.push({
          id: `q-${i + 1}-${index + 1}`,
          text: followUp,
          main_question_index: i + 1,
          follow_up_index: index + 1,
          knowledge_question_id: knowledge.id,
          template_version: template.version,
          source_refs: knowledge.source_refs,
        }),
      );
    }
    if (
      project &&
      (config.interview_type === 'project_deep_dive' || config.interview_type === 'mixed') &&
      i < 2
    ) {
      questions.push({
        id: `q-${i + 1}-1`,
        text:
          i === 0
            ? '这部分工作中，哪些是你独立完成的，哪些与同学协作完成？'
            : '当时考虑过其他方案吗？为什么最终选择了这个方案？',
        main_question_index: i + 1,
        follow_up_index: 1,
      });
      if (config.interviewer_style === '深入追问')
        questions.push({
          id: `q-${i + 1}-2`,
          text: '能用一个具体的实现细节或验证过程说明吗？',
          main_question_index: i + 1,
          follow_up_index: 2,
        });
    }
  });
  return questions;
}
