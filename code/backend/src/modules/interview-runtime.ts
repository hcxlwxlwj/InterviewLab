import { createKnowledgeService } from './knowledge/service';
import { withRealtimeAgent } from './interviews/agent-v3';
import type { InterviewKnowledgeProvider, InterviewKnowledgeRuntime } from '@interviewlab/core';
import type { Database } from '../database/connection';
import type { BackendConfig } from '../foundation/config';
import { ServiceError } from '../foundation/errors';
import { createInterviewAgent, type InterviewAgent } from './interviews/agent';
import { createInterviewsService, type InterviewReportHooks } from './interviews/service';
import { createReportsService } from './reports/service';
import { interviewsModule } from './interviews/routes';
import { reportsModule } from './reports/routes';
import type { TaskRow } from '../tasks/service';

export interface InterviewRuntimeOptions {
  agent?: InterviewAgent;
  knowledge?: InterviewKnowledgeProvider;
  realtimeKnowledge?: InterviewKnowledgeRuntime;
  log?: (entry: object) => void;
  onFinalize?: InterviewReportHooks['seal'];
}
export function createInterviewRuntime(
  database: Database,
  config: BackendConfig,
  options: InterviewRuntimeOptions = {},
) {
  const knowledge = createKnowledgeService(config);
  const agent =
    options.agent ??
    withRealtimeAgent(createInterviewAgent(config, fetch, options.log), config, options.log);
  const interviews = createInterviewsService(
    database,
    options.knowledge ?? options.realtimeKnowledge ?? knowledge,
    agent,
    {
      seal: options.onFinalize ?? ((tx, state) => reports.seal(tx, state)),
      erase: (tx, owner, id) => reports.erase(tx, owner, id),
    },
    options.realtimeKnowledge ?? knowledge,
  );
  const reports = createReportsService(database, interviews, agent);
  return {
    agent,
    close: async () => {
      await interviews.streams.close();
      await knowledge.close();
    },
    interviews,
    reports,
    modules: [interviewsModule(interviews), reportsModule(reports)],
    handlers: { ...interviews.handlers, ...reports.handlers },
    async maintain() {
      await interviews.maintain();
      await reports.maintain();
    },
    async isCancelled(task: Readonly<TaskRow>) {
      const input = task.payload as {
        interview_id?: string;
        generation_id?: string;
        comparison_id?: string;
        version?: number;
      };
      try {
        if (input.interview_id) {
          const current = await interviews.read(
            { owner_id: task.owner_id, roles: [] },
            input.interview_id,
          );
          return Boolean(
            input.generation_id &&
              (current.generation_id !== input.generation_id || current.status !== 'in_progress'),
          );
        }
        if (input.comparison_id) {
          const current = await reports.getComparison(
            { owner_id: task.owner_id, roles: [] },
            input.comparison_id,
          );
          return current.version !== input.version;
        }
        return false;
      } catch (error) {
        if (error instanceof ServiceError && error.statusCode === 404) return true;
        throw error;
      }
    },
  };
}
