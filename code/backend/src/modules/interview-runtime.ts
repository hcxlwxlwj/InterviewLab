import { createAllRoleKnowledge } from './knowledge/all-roles';
import { createResumeAnalysis } from './resumes/analysis';
import { createWorkflowModels, type WorkflowModels } from './interviews/workflow-models';
import { createInterviewPreparation } from './interviews/preparation';
import { createInterviewAgent } from './interviews/agent';
import { createMaterialsService } from './resumes/service';
import type { InterviewKnowledgeProvider, InterviewKnowledgeRuntime } from '@interviewlab/core';
import type { Database } from '../database/connection';
import type { BackendConfig } from '../foundation/config';
import { ServiceError } from '../foundation/errors';
import type { InterviewAgent } from './interviews/model-analysis';
import { createInterviewsService, type InterviewReportHooks } from './interviews/service';
import { createReportsService } from './reports/service';
import { interviewsModule } from './interviews/routes';
import { reportsModule } from './reports/routes';
import type { TaskRow } from '../tasks/service';
import type { VoiceProvider } from './interviews/voice/volcengine';

export interface InterviewRuntimeOptions {
  workflowModels?: WorkflowModels;
  voiceProvider?: VoiceProvider;
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
  const knowledge = createAllRoleKnowledge(config);
  const content = options.knowledge ?? options.realtimeKnowledge ?? knowledge;
  const models = options.workflowModels ?? createWorkflowModels(config, fetch, options.log);
  const resumeAnalysis = createResumeAnalysis(database, config, models);
  const materials = createMaterialsService(database, resumeAnalysis, true);
  const agent =
    options.agent ??
    createInterviewAgent(config, options.log);
  const interviews = createInterviewsService(
    database,
    content,
    agent,
    {
      prepare: options.onFinalize ? undefined : (tx, state) => reports.prepare(tx, state),
      seal: options.onFinalize ?? ((tx, state) => reports.seal(tx, state)),
      erase: (tx, owner, id) => reports.erase(tx, owner, id),
    },
    options.realtimeKnowledge ?? {
      ...knowledge,
      read: (c) => knowledge.read(c),
      profiles: (c) => knowledge.profiles(c),
      prefetch: (c,k,m) => knowledge.prefetch(c,k,m),
      context: (c,k,m,a,s) => knowledge.context(c,k,m,a,s),
    },
    async (owner,id,version)=>{const versions=await materials.versions(owner,id);const material=versions.find(v=>v.version===version&&v.kind==='resume'&&v.confirmed);if(!material)throw new ServiceError('unsupported_input',400,'请选择本人已确认的简历版本');return material;},
    {
      initialize: (identity,id) => preparation.initialize(identity,id),
      request: (identity,id,body,key) => preparation.request(identity,id,body,key),
    },
  );
  const preparation=createInterviewPreparation(database,config,content,materials,resumeAnalysis,models);
  const reports = createReportsService(database, interviews, agent);
  return {
    agent,
    materials,
    close: async () => {
      await interviews.streams.close();
      await knowledge.close();
    },
    interviews,
    reports,
    modules: [
      interviewsModule(interviews, { config, provider: options.voiceProvider }),
      reportsModule(reports),
    ],
    handlers: { ...interviews.handlers, ...reports.handlers, ...resumeAnalysis.handlers, ...preparation.handlers },
    async maintain() {
      await preparation.maintain();
      await interviews.maintain();
      await reports.maintain();
    },
    async isCancelled(task: Readonly<TaskRow>) {
      const input = task.payload as {
        interview_id?: string;
        generation_id?: string;
        report_id?: string;
        report_version?: number;
        comparison_id?: string;
        version?: number;
      };
      try {
        if (task.type === 'preparation.plan.v1' && input.interview_id) {
          const state=await interviews.read({owner_id:task.owner_id,roles:[]},input.interview_id);
          return state.status !== 'ready' || state.preparation?.task_id !== task.id;
        }
        if (input.interview_id) {
          if (task.type === 'reports.evaluate.v1') return await reports.isEvaluationCancelled(task);
          const current = await interviews.read(
            { owner_id: task.owner_id, roles: [] },
            input.interview_id,
          );
          if (input.report_id) {
            const report = await reports.get(
              { owner_id: task.owner_id, roles: [] },
              input.interview_id,
            );
            return report.id !== input.report_id || report.version !== input.report_version;
          }
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
