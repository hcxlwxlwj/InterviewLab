import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { PersonalMaterial, PersonalSettings, ResumeAnalysis } from '@interviewlab/core';
export const accountSettings = pgTable('account_settings', {
  owner_id: text().primaryKey(),
  data: jsonb().$type<PersonalSettings>().notNull(),
});
export const resumeMaterials = pgTable(
  'resume_materials',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    kind: text().notNull(),
    deleted: boolean().notNull().default(false),
  },
  (t) => [index('resume_material_owner').on(t.owner_id)],
);
export const resumeMaterialVersions = pgTable(
  'resume_material_versions',
  {
    id: uuid()
      .notNull()
      .references(() => resumeMaterials.id),
    version: integer().notNull(),
    data: jsonb().$type<PersonalMaterial>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.version] })],
);
export const resumeAnalyses = pgTable(
  'resume_analyses',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    material_id: uuid()
      .notNull()
      .references(() => resumeMaterials.id),
    material_version: integer().notNull(),
    input_digest: text().notNull(),
    model: text().notNull(),
    prompt_version: text().notNull(),
    task_id: uuid().notNull(),
    result: jsonb().$type<ResumeAnalysis>(),
  },
  (t) => [
    uniqueIndex('resume_analysis_source').on(
      t.owner_id,
      t.material_id,
      t.material_version,
      t.input_digest,
      t.model,
      t.prompt_version,
    ),
  ],
);
