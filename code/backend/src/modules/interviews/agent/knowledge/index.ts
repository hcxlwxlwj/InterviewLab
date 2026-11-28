/** 面试专业知识入口：读取已发布岗位和适用题目，保留来源与内容版本。 */
import { withFrontendReportReference } from '../../frontend-reference';
import type { InterviewKnowledgeProvider } from '@interviewlab/core';
import {
  PUBLIC_INTERVIEW_SUPPLEMENTS,
  getJob,
  localKnowledgeRetriever,
} from '../../../../content/index';
import { ServiceError } from '../../../../foundation/errors';

/** Structured view of the same published catalog used to build the vector index. */
export const structuredInterviewKnowledge: InterviewKnowledgeProvider = {
  async read(config) {
    const job = getJob(config.job);
    if (!job || !job.stages.includes(config.career_stage))
      throw new ServiceError('unsupported_input', 400, '岗位或招聘阶段不可用');
    const result = await localKnowledgeRetriever.retrieve({
      job_id: job.id,
      stage: config.career_stage,
      interview_type: config.interview_type,
    });
    const mainQuestions = result.items.some((question) => question.difficulty === '基础')
      ? result.items.filter((question) => question.difficulty === '基础')
      : result.items;
    const ratedMainQuestions =
      config.job === 'frontend' ? mainQuestions.map(withFrontendReportReference) : mainQuestions;
    const supplementPriority = Math.min(result.supplemental_questions.length, 2);
    // Keep supplemental evidence inside the eight-item preparation budget without displacing the main six.
    const questions = [
      ...ratedMainQuestions.slice(0, 6),
      ...result.supplemental_questions.slice(0, supplementPriority),
      ...ratedMainQuestions.slice(6),
      ...result.supplemental_questions.slice(supplementPriority),
    ];
    const supplementVersion = PUBLIC_INTERVIEW_SUPPLEMENTS.questions.reduce(
      (version, question) => Math.max(version, question.version),
      0,
    );
    return {
      content_version: `${job.id}:${job.version}:public-${supplementVersion}`,
      questions,
      sources: result.sources,
      missing_reason: questions.length ? null : '暂无适用的已发布专业题目，使用通用流程提问。',
    };
  },
};
