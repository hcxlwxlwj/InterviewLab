import assert from 'node:assert/strict';
import { config as dotenv } from 'dotenv';
import { createKnowledgeService } from '../../code/backend/src/modules/knowledge/service';
import { loadConfig } from '../../code/backend/src/foundation/config';
async function main() {
  dotenv({ quiet: true });
  const service = createKnowledgeService(loadConfig({ ...process.env, KNOWLEDGE_PREVIEW: 'true' }));
  try {
    for (const type of ['technical_qa', 'business_scenario', 'hr', 'mixed'] as const) {
      const c = {
        job: 'frontend',
        career_stage: 'internship' as const,
        interview_type: type,
        difficulty: '基础' as const,
        duration_minutes: 5 as const,
        interviewer_style: '标准' as const,
        interaction_mode: 'text_fallback' as const,
      };
      const k = await service.read(c);
      const goals = k.agent_release!.profile.goals.slice(0, 2);
      const query = goals
        .map((g) => {
          const v = k.agent_release!.competencies.find((x) => x.id === g)!;
          return `${v.title} ${v.evidence_wanted}`;
        })
        .join(' ');
      const result = await service.search(c, k, goals, query);
      console.log(
        JSON.stringify({
          type,
          goals,
          mode: result.mode,
          ids: result.chunks.map((x) => x.id),
          reason: result.missing_reason,
        }),
      );
      if (type === 'hr') {
        const context = await service.context(
          c,
          k,
          null,
          '我负责缓存和表单，但没有测过加载时间。',
          new AbortController().signal,
        );
        assert.ok(context.chunks.some((x) => x.card_id === 'fe-k17' || x.card_id === 'fe-k18'));
        assert.equal(context.mode, 'prefetched');
      }
    }
  } finally {
    await service.close();
  }
}
main().catch(() => {
  console.error('Prefetch validation failed');
  process.exitCode = 1;
});
