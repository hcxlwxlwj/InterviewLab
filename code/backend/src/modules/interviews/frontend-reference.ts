import type { KnowledgeQuestion } from '@interviewlab/core';
import { frontendReportReference as reference } from '../../content/index';

/** Explicit topic matching avoids attaching unrelated professional authority to a question. */
export function withFrontendReportReference(question: KnowledgeQuestion): KnowledgeQuestion {
  const cards = reference.cards.filter((card) =>
    card.topics.some((topic) => question.topic.toLowerCase().includes(topic.toLowerCase())),
  );
  if (!cards.length) return question;
  return {
    ...question,
    report_reference: {
      version: reference.version,
      review_state: 'draft',
      limitations: reference.limitations,
      cards,
    },
  };
}
