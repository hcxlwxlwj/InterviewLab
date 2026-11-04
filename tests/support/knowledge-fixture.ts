import { COMPETENCIES, catalogProfile } from '../../code/backend/src/modules/knowledge/catalog';
export async function currentKnowledgeFixture() { return { id: 'all-roles-v1', competencies: COMPETENCIES, profiles: (['technical_qa','project_deep_dive','business_scenario','hr','mixed'] as const).map(catalogProfile) }; }
