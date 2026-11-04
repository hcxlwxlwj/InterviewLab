import { withFrontendReportReference } from './frontend-reference';
import type { InterviewKnowledgeProvider } from '@interviewlab/core';
import { getJob, localKnowledgeRetriever } from '../../content/index';
import { ServiceError } from '../../foundation/errors';

/** Structured view of the same published catalog used to build the vector index. */
export const structuredInterviewKnowledge: InterviewKnowledgeProvider = {
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
      questions:
        config.job === 'frontend' ? result.items.map(withFrontendReportReference) : result.items,
      sources: result.sources,
      missing_reason: result.items.length ? null : '暂无适用的已发布专业题目，使用通用流程提问。',
    };
  },
};
