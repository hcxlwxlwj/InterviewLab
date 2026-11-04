import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  MemberRole,
  ModuleName,
  RequestIdentity,
} from '@interviewlab/core';

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
export function validateModules(modules: BackendModule[]) {
  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.name)) throw new Error('Duplicate module registration: ' + module.name);
    seen.add(module.name);
  }
}
