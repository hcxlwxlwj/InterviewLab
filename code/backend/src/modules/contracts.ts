import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  Experience,
  JobTarget,
  KnowledgeQuery,
  KnowledgeRetriever,
  MemberRole,
  ModuleName,
  RequestIdentity,
  ResumeDocument,
  VersionRef,
} from '@interviewlab/core';
import type { IdentityProvider } from '../foundation/auth';

export interface BackendModule {
  name: ModuleName;
  register(app: FastifyInstance, context: ModuleContext): Promise<void>;
}
export interface ModuleContext {
  requireIdentity(request: FastifyRequest): Promise<RequestIdentity>;
  requireRole(identity: RequestIdentity, role: MemberRole): void;
}
export const MODULES: Record<ModuleName, { owns: string; status: 'available' | 'planned' }> = {
  accounts: { owns: 'Identity, roles, preferences and default resume pointer', status: 'planned' },
  resumes: {
    owns: 'Resumes, confirmed experiences, versions and private material references',
    status: 'planned',
  },
  jobs: { owns: 'Public job queries (personal JD and bookmarks planned)', status: 'available' },
  interviews: {
    owns: 'Interview state, snapshots, questions, answers and finalization',
    status: 'available',
  },
  reports: {
    owns: 'Evidence reports, retry relations and comparisons (exports planned)',
    status: 'available',
  },
  knowledge: {
    owns: 'Published content, sources, questions, rubrics and index versions',
    status: 'planned',
  },
};
/** Narrow integration seams. Domain-specific commands are added by their owning module. */
export interface AccountsService extends IdentityProvider {}
export interface ResumesService {
  readConfirmed(
    identity: RequestIdentity,
    selection: {
      resume?: VersionRef;
      experiences: VersionRef[];
    },
  ): Promise<{ resume?: ResumeDocument; experiences: Experience[] }>;
}
export interface JobTargetsService {
  readVersion(identity: RequestIdentity, ref: VersionRef): Promise<JobTarget>;
}
export interface FinalizedInterviewInput {
  interview: VersionRef;
  owner_id: string;
  input_digest: string;
  snapshot_ref: VersionRef;
  answer_refs: { id: string; revision: number }[];
  ended_at: string;
  reason: string;
}
export interface InterviewsService {
  readFinalized(identity: RequestIdentity, ref: VersionRef): Promise<FinalizedInterviewInput>;
}
export interface ReportsService {
  invalidateSource(identity: RequestIdentity, source: VersionRef): Promise<void>;
}
export interface KnowledgeService {
  retrieve(
    query: KnowledgeQuery & { content_version: number },
  ): ReturnType<KnowledgeRetriever['retrieve']>;
}
export interface ServiceRegistry {
  accounts?: AccountsService;
  resumes?: ResumesService;
  jobTargets?: JobTargetsService;
  interviews?: InterviewsService;
  reports?: ReportsService;
  knowledge?: KnowledgeService;
}

export function validateModules(modules: BackendModule[]) {
  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.name)) throw new Error('Duplicate module registration: ' + module.name);
    seen.add(module.name);
  }
}
