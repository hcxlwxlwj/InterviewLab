import type { InterviewKnowledgeProvider } from '@interviewlab/core';
import { getJob, localKnowledgeRetriever } from '../../content/index';
import { ServiceError } from '../../foundation/errors';

/** Replace this injected provider when the team's knowledge service is ready. */
export const localInterviewKnowledge: InterviewKnowledgeProvider = {
  async read(config) {
    const job = getJob(config.job);
    if (!job || !job.stages.includes(config.career_stage))
      throw new ServiceError('unsupported_input', 400, '岗位或招聘阶段不可用');
    const result = await localKnowledgeRetriever.retrieve({
      job_id: job.id,
      stage: config.career_stage,
      difficulty: '基础',
    });
    return {
      content_version: `${job.id}:${job.version}`,
      questions: result.items,
      sources: result.sources,
      missing_reason: result.items.length ? null : '暂无适用的已发布专业题目，使用通用流程提问。',
    };
  },
};
