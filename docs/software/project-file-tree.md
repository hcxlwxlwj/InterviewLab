# 项目文件树

基于当前工作区的 Git 跟踪文件及未忽略的新文件生成，只列出实际存在的文件。`.env`、`data/private/`、`node_modules/`、`.next/`、`dist/` 等被 Git 忽略的本地配置、私有数据和生成物不展开。历史截图、扫描结果和迁移记录保留原样。

文件会随开发变化；职责说明见[工程目录](repository_structure.md)。

```text
InterviewLab/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── config.yml
│   │   ├── task.yml
│   │   └── teacher_feedback.yml
│   ├── scripts/
│   │   ├── check-boundaries.ts
│   │   ├── check-content.ts
│   │   └── check_repository.py
│   ├── workflows/
│   │   └── repository-check.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── code/
│   ├── backend/
│   │   ├── drizzle/
│   │   │   ├── meta/
│   │   │   │   ├── 0000_snapshot.json
│   │   │   │   ├── 0001_snapshot.json
│   │   │   │   ├── 0002_snapshot.json
│   │   │   │   ├── 0003_snapshot.json
│   │   │   │   ├── 0004_snapshot.json
│   │   │   │   ├── 0005_snapshot.json
│   │   │   │   ├── 0006_snapshot.json
│   │   │   │   ├── 0007_snapshot.json
│   │   │   │   ├── 0009_snapshot.json
│   │   │   │   ├── 0011_snapshot.json
│   │   │   │   └── _journal.json
│   │   │   ├── 0000_lame_skin.sql
│   │   │   ├── 0001_far_the_spike.sql
│   │   │   ├── 0002_futuristic_genesis.sql
│   │   │   ├── 0003_curved_loki.sql
│   │   │   ├── 0004_text_report_summary.sql
│   │   │   ├── 0005_massive_marvex.sql
│   │   │   ├── 0006_personal_materials.sql
│   │   │   ├── 0007_agent_preparation.sql
│   │   │   ├── 0007_reset_report_scoring.sql
│   │   │   ├── 0009_reconcile_agent_preparation.sql
│   │   │   ├── 0010_job_bookmarks.sql
│   │   │   ├── 0011_voice_publication_activity.sql
│   │   │   ├── 0012_interview_time_extension.sql
│   │   │   └── 0013_interview_question_budget.sql
│   │   ├── src/
│   │   │   ├── content/
│   │   │   │   ├── index.ts
│   │   │   │   └── README.md
│   │   │   ├── database/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   └── schema.ts
│   │   │   ├── entrypoints/
│   │   │   │   ├── api.ts
│   │   │   │   ├── create-user.ts
│   │   │   │   ├── environment.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   ├── openapi.ts
│   │   │   │   └── worker.ts
│   │   │   ├── foundation/
│   │   │   │   ├── agent/
│   │   │   │   │   └── graph.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── config.ts
│   │   │   │   ├── errors.ts
│   │   │   │   ├── idempotency.ts
│   │   │   │   └── schemas.ts
│   │   │   ├── modules/
│   │   │   │   ├── accounts/
│   │   │   │   │   ├── auth-routes.ts
│   │   │   │   │   ├── auth-schema.ts
│   │   │   │   │   ├── auth-service.ts
│   │   │   │   │   ├── provision.ts
│   │   │   │   │   └── settings.ts
│   │   │   │   ├── interviews/
│   │   │   │   │   ├── agent/
│   │   │   │   │   │   ├── guardrails/
│   │   │   │   │   │   │   ├── preview.ts
│   │   │   │   │   │   │   ├── question-policy.ts
│   │   │   │   │   │   │   └── question.ts
│   │   │   │   │   │   ├── memory/
│   │   │   │   │   │   │   └── memory.ts
│   │   │   │   │   │   ├── planner/
│   │   │   │   │   │   │   └── planning.ts
│   │   │   │   │   │   ├── runtime/
│   │   │   │   │   │   │   ├── interview-agent.ts
│   │   │   │   │   │   │   ├── model.ts
│   │   │   │   │   │   │   ├── prompt.ts
│   │   │   │   │   │   │   ├── streaming-agent.ts
│   │   │   │   │   │   │   ├── types.ts
│   │   │   │   │   │   │   └── workflow-models.ts
│   │   │   │   │   │   └── tools/
│   │   │   │   │   │       └── knowledge.ts
│   │   │   │   │   ├── voice/
│   │   │   │   │   │   ├── activity.ts
│   │   │   │   │   │   ├── routes.ts
│   │   │   │   │   │   ├── session.ts
│   │   │   │   │   │   └── volcengine.ts
│   │   │   │   │   ├── api-schemas.ts
│   │   │   │   │   ├── conversation.ts
│   │   │   │   │   ├── db-schema.ts
│   │   │   │   │   ├── events.ts
│   │   │   │   │   ├── experience.ts
│   │   │   │   │   ├── frontend-reference.ts
│   │   │   │   │   ├── participation.ts
│   │   │   │   │   ├── preparation.ts
│   │   │   │   │   ├── repository.ts
│   │   │   │   │   ├── response-assessment.ts
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   ├── service.ts
│   │   │   │   │   ├── stream-parser.ts
│   │   │   │   │   └── streams.ts
│   │   │   │   ├── jobs/
│   │   │   │   │   ├── bookmarks.ts
│   │   │   │   │   ├── db-schema.ts
│   │   │   │   │   ├── repository.ts
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   └── service.ts
│   │   │   │   ├── knowledge/
│   │   │   │   │   ├── all-roles.ts
│   │   │   │   │   ├── catalog-command.ts
│   │   │   │   │   ├── catalog.ts
│   │   │   │   │   ├── embedding.ts
│   │   │   │   │   └── migrate-v2.sql
│   │   │   │   ├── reports/
│   │   │   │   │   ├── agent/
│   │   │   │   │   │   ├── advice.ts
│   │   │   │   │   │   ├── analysis.ts
│   │   │   │   │   │   ├── contracts.ts
│   │   │   │   │   │   ├── evaluation.ts
│   │   │   │   │   │   ├── guardrails.ts
│   │   │   │   │   │   ├── model-analysis.ts
│   │   │   │   │   │   ├── runtime.ts
│   │   │   │   │   │   └── summary.ts
│   │   │   │   │   ├── aggregate.ts
│   │   │   │   │   ├── api-schemas.ts
│   │   │   │   │   ├── db-schema.ts
│   │   │   │   │   ├── README.md
│   │   │   │   │   ├── repository.ts
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   └── service.ts
│   │   │   │   ├── resumes/
│   │   │   │   │   ├── analysis.ts
│   │   │   │   │   ├── db-schema.ts
│   │   │   │   │   ├── pdf.ts
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   └── service.ts
│   │   │   │   ├── agent-runtime.ts
│   │   │   │   ├── contracts.ts
│   │   │   │   └── interview-runtime.ts
│   │   │   ├── server/
│   │   │   │   └── app.ts
│   │   │   ├── tasks/
│   │   │   │   ├── outbox.ts
│   │   │   │   ├── queue.ts
│   │   │   │   ├── runner.ts
│   │   │   │   ├── service.ts
│   │   │   │   └── worker.ts
│   │   │   └── index.ts
│   │   ├── AGENTS.md
│   │   ├── compose.yaml
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   ├── README.md
│   │   └── tsup.config.ts
│   ├── core_engine/
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── interview.ts
│   │   │   │   └── knowledge.ts
│   │   │   ├── agent-workflow.ts
│   │   │   ├── configuration.ts
│   │   │   ├── feedback-template.ts
│   │   │   ├── foundation.ts
│   │   │   ├── index.ts
│   │   │   ├── interview-agent.ts
│   │   │   ├── interview-policy.ts
│   │   │   ├── interview-response.ts
│   │   │   ├── knowledge.ts
│   │   │   ├── live-interview.ts
│   │   │   ├── performance-profile.ts
│   │   │   ├── personal.ts
│   │   │   ├── question-scoring.ts
│   │   │   ├── report-rubric.ts
│   │   │   ├── resume-template.ts
│   │   │   └── voice.ts
│   │   ├── package.json
│   │   └── README.md
│   ├── frontend/
│   │   ├── app/
│   │   │   ├── interview/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── analysis/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── prepare/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── video/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── setup/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── [slug]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── me/
│   │   │   │   ├── interviews/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── preferences/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── profile/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── resumes/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── saved-jobs/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── reports/
│   │   │   │   └── [id]/
│   │   │   │       ├── practice/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── page.tsx
│   │   │   ├── auth.css
│   │   │   ├── error.tsx
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── library.css
│   │   │   ├── live-interview.css
│   │   │   ├── loading.tsx
│   │   │   ├── not-found.tsx
│   │   │   ├── page.tsx
│   │   │   ├── refinement.css
│   │   │   └── workspace.css
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   └── button.tsx
│   │   │   ├── account-access.tsx
│   │   │   ├── account-controls.tsx
│   │   │   ├── auth-form.tsx
│   │   │   ├── bookmark-button.tsx
│   │   │   ├── interview-setup.tsx
│   │   │   ├── interview-workspace.tsx
│   │   │   ├── job-library.tsx
│   │   │   ├── session-provider.tsx
│   │   │   └── shared.tsx
│   │   ├── features/
│   │   │   ├── live-interview/
│   │   │   │   ├── voice/
│   │   │   │   │   ├── call-presentation.ts
│   │   │   │   │   ├── client.ts
│   │   │   │   │   ├── controls.tsx
│   │   │   │   │   ├── devices.ts
│   │   │   │   │   ├── playback.ts
│   │   │   │   │   └── use-voice.ts
│   │   │   │   ├── analysis-state.ts
│   │   │   │   ├── analysis.tsx
│   │   │   │   ├── common.tsx
│   │   │   │   ├── entry-request.ts
│   │   │   │   ├── flow-provider.tsx
│   │   │   │   ├── history.tsx
│   │   │   │   ├── interview-notices.tsx
│   │   │   │   ├── interview-presentation.ts
│   │   │   │   ├── interview.tsx
│   │   │   │   ├── preparation.tsx
│   │   │   │   ├── presentation-request.ts
│   │   │   │   ├── question-scores.tsx
│   │   │   │   ├── report-charts.tsx
│   │   │   │   ├── report-design.css
│   │   │   │   ├── report-export.ts
│   │   │   │   ├── report-insights.tsx
│   │   │   │   ├── report-overview.tsx
│   │   │   │   ├── report-practice.tsx
│   │   │   │   ├── report-progress.tsx
│   │   │   │   ├── report-standard.tsx
│   │   │   │   ├── report.tsx
│   │   │   │   ├── review-advice.ts
│   │   │   │   ├── review-conversation.tsx
│   │   │   │   ├── setup-controller.ts
│   │   │   │   ├── setup-fields.tsx
│   │   │   │   ├── setup-panels.tsx
│   │   │   │   ├── setup-state.ts
│   │   │   │   ├── setup-summary.tsx
│   │   │   │   ├── setup.tsx
│   │   │   │   ├── start-request.ts
│   │   │   │   ├── stream.ts
│   │   │   │   ├── transition-screen.css
│   │   │   │   ├── transition-screen.tsx
│   │   │   │   ├── use-prepared-devices.ts
│   │   │   │   └── use-question-presentation.ts
│   │   │   ├── personal-center/
│   │   │   │   ├── live-workspace.tsx
│   │   │   │   ├── materials-workspace.tsx
│   │   │   │   ├── profile-overview.tsx
│   │   │   │   ├── resume-records.tsx
│   │   │   │   ├── saved-jobs-live.tsx
│   │   │   │   └── workspace-frame.tsx
│   │   │   └── video-interview/
│   │   │       ├── interviewer-avatar.tsx
│   │   │       ├── media-preview.tsx
│   │   │       ├── room.css
│   │   │       └── room.tsx
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── http.ts
│   │   │   │   ├── interviews.ts
│   │   │   │   └── jobs.ts
│   │   │   ├── access.ts
│   │   │   └── utils.ts
│   │   ├── public/
│   │   │   ├── avatars/
│   │   │   │   └── interviewer-reference-sprite.png
│   │   │   ├── fonts/
│   │   │   │   ├── interviewlab-sans.woff2
│   │   │   │   └── OFL.txt
│   │   │   ├── images/
│   │   │   │   ├── interview-hero-wide.png
│   │   │   │   └── study-desk.png
│   │   │   └── voice-capture.worklet.js
│   │   ├── AGENTS.md
│   │   ├── components.json
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   ├── postcss.config.mjs
│   │   ├── README.md
│   │   └── tsconfig.json
│   └── README.md
├── docs/
│   ├── algorithm/
│   │   ├── content/
│   │   │   ├── archive/
│   │   │   │   ├── jobs-v1.json
│   │   │   │   ├── jobs-v2.json
│   │   │   │   └── sources-v1.json
│   │   │   ├── research/
│   │   │   │   ├── sources-2026-10-19.json
│   │   │   │   ├── sources-2026-10-28-batch2.json
│   │   │   │   ├── sources-2026-10-28-batch3.json
│   │   │   │   ├── sources-2026-10-28-batch4.json
│   │   │   │   ├── sources-2026-10-28-batch5.json
│   │   │   │   ├── sources-2026-10-28-multiplatform.json
│   │   │   │   └── sources-2026-10-28.json
│   │   │   ├── review/
│   │   │   │   ├── latest-role-mining/
│   │   │   │   │   └── raw/
│   │   │   │   │       ├── baidu-bytedance.json
│   │   │   │   │       ├── jd-pdd-360.json
│   │   │   │   │       ├── manifest.json
│   │   │   │   │       ├── meituan-kuaishou.json
│   │   │   │   │       ├── redbook-bilibili.json
│   │   │   │   │       ├── tencent-netease.json
│   │   │   │   │       ├── university-game-hardware.json
│   │   │   │   │       └── xiaomi-huawei-alibaba.json
│   │   │   │   ├── public-interview-mining/
│   │   │   │   │   ├── public-interview-candidates.csv
│   │   │   │   │   └── public-interview-sources.csv
│   │   │   │   ├── job-classification.csv
│   │   │   │   └── role-taxonomy-v2.json
│   │   │   ├── categories.json
│   │   │   ├── frontend-report-reference.json
│   │   │   ├── jobs.json
│   │   │   ├── latest-role-supplements.json
│   │   │   ├── professional-foundations.json
│   │   │   ├── public-interview-supplements.json
│   │   │   ├── README.md
│   │   │   ├── sources.json
│   │   │   └── teacher-agent-questions.json
│   │   ├── evaluation.md
│   │   ├── frontend-scoring-standard.md
│   │   ├── knowledge_and_agent.md
│   │   ├── README.md
│   │   └── research.md
│   ├── mgmt/
│   │   ├── COLLABORATION.md
│   │   ├── communication_mgmt_plan.md
│   │   ├── project_management.md
│   │   ├── README.md
│   │   ├── risk_mgmt_plan.md
│   │   └── team_plan.md
│   ├── requirements/
│   │   ├── functional_spec.md
│   │   ├── nonfunctional_spec.md
│   │   ├── problem_definition.md
│   │   ├── README.md
│   │   └── user_stories.md
│   ├── retrospection/
│   │   ├── evidence/
│   │   │   ├── agent-model-20261104.json
│   │   │   ├── agent-model-data-recheck-20261104.json
│   │   │   ├── background-validation-20261104.json
│   │   │   └── knowledge-embedding-20261104.json
│   │   ├── 2026-10-15-scope-revision.md
│   │   ├── 2026-10-19-course-layout.md
│   │   ├── 2026-10-19-docs-consolidation.md
│   │   ├── 2026-10-19-materials-and-content.md
│   │   ├── 2026-10-19-repository-organization.md
│   │   ├── 2026-11-04-agent-engineering.md
│   │   ├── 2026-11-05-runtime-cleanup.md
│   │   ├── 2026-11-28-architecture-refactor.md
│   │   ├── README.md
│   │   ├── report-implementation-plan.md
│   │   ├── teacher_feedback.md
│   │   └── week1_submission.md
│   ├── software/
│   │   ├── prototype/
│   │   │   ├── references/
│   │   │   │   ├── home.png
│   │   │   │   ├── interview.png
│   │   │   │   ├── job-detail-v3.png
│   │   │   │   ├── jobs-catalog-v3.png
│   │   │   │   ├── personal-center.png
│   │   │   │   ├── personal-workspace-v3.png
│   │   │   │   ├── report.png
│   │   │   │   └── setup.png
│   │   │   ├── screenshots/
│   │   │   │   ├── code-desktop.jpg
│   │   │   │   ├── comparison-desktop.jpg
│   │   │   │   ├── empty-records-mobile-v3.jpg
│   │   │   │   ├── home-desktop-v2.jpg
│   │   │   │   ├── home-desktop.jpg
│   │   │   │   ├── home-mobile-v2.jpg
│   │   │   │   ├── home-mobile.jpg
│   │   │   │   ├── interview-desktop.jpg
│   │   │   │   ├── interview-mobile.jpg
│   │   │   │   ├── interview-participation-confirmation.png
│   │   │   │   ├── interviews-desktop-v3.jpg
│   │   │   │   ├── interviews-mobile-v3.jpg
│   │   │   │   ├── job-detail-desktop-v3.jpg
│   │   │   │   ├── job-detail-mobile-v3.jpg
│   │   │   │   ├── jobs-desktop-v3.jpg
│   │   │   │   ├── jobs-mobile-v3.jpg
│   │   │   │   ├── layout-audit-v3.json
│   │   │   │   ├── live-conversation-v2.png
│   │   │   │   ├── live-ecnu-plus-comparison.png
│   │   │   │   ├── live-entry-clarity.png
│   │   │   │   ├── live-original-interview.png
│   │   │   │   ├── live-original-setup.png
│   │   │   │   ├── live-report-desktop.png
│   │   │   │   ├── live-setup-mobile.png
│   │   │   │   ├── personal-center-desktop-v2.jpg
│   │   │   │   ├── personal-center-desktop-v3.jpg
│   │   │   │   ├── personal-center-desktop.jpg
│   │   │   │   ├── personal-center-mobile-v3.jpg
│   │   │   │   ├── personal-center-mobile.jpg
│   │   │   │   ├── report-desktop-v2.jpg
│   │   │   │   ├── report-desktop-v3.jpg
│   │   │   │   ├── report-desktop.jpg
│   │   │   │   ├── report-mobile-v3.jpg
│   │   │   │   ├── report-mobile.jpg
│   │   │   │   ├── repository-refactor-records.png
│   │   │   │   ├── resume-editor-desktop-v3.jpg
│   │   │   │   ├── resume-editor-mobile-v3.jpg
│   │   │   │   ├── resumes-desktop-v3.jpg
│   │   │   │   ├── resumes-mobile-v3.jpg
│   │   │   │   ├── saved-jobs-desktop-v3.jpg
│   │   │   │   ├── saved-jobs-mobile-v3.jpg
│   │   │   │   ├── setup-desktop-v2.jpg
│   │   │   │   ├── setup-desktop-v3.jpg
│   │   │   │   ├── setup-desktop.jpg
│   │   │   │   ├── setup-mobile-v3.jpg
│   │   │   │   └── setup-mobile.jpg
│   │   │   ├── design-prompts.md
│   │   │   ├── extension-prompts.md
│   │   │   ├── implementation.md
│   │   │   ├── library-expansion.md
│   │   │   └── README.md
│   │   ├── quality/
│   │   │   ├── 2026-11-25/
│   │   │   │   ├── followup/
│   │   │   │   │   ├── audit-boolean-conditions.cjs
│   │   │   │   │   ├── audit-modules.cjs
│   │   │   │   │   ├── coverage.json
│   │   │   │   │   ├── engineering-checks.json
│   │   │   │   │   ├── eslint.config.mjs
│   │   │   │   │   ├── followup-strict.config.mjs
│   │   │   │   │   ├── scan-report.html
│   │   │   │   │   ├── scan-report.png
│   │   │   │   │   ├── scan.json
│   │   │   │   │   └── strict-duplication-probe.json
│   │   │   │   ├── baseline-workspace.patch
│   │   │   │   ├── eslint.config.mjs
│   │   │   │   ├── scan-report.html
│   │   │   │   ├── scan-report.png
│   │   │   │   └── scan.json
│   │   │   ├── 2026-11-26/
│   │   │   │   ├── interview-setup/
│   │   │   │   │   └── scan.json
│   │   │   │   ├── remote-sync/
│   │   │   │   │   ├── checks.json
│   │   │   │   │   ├── coverage.json
│   │   │   │   │   ├── duplication.json
│   │   │   │   │   ├── findings.md
│   │   │   │   │   ├── gitleaks.json
│   │   │   │   │   └── scan.json
│   │   │   │   └── setup-review/
│   │   │   │       ├── coverage.json
│   │   │   │       ├── duplication-probe.json
│   │   │   │       ├── engineering-checks.json
│   │   │   │       ├── extract-lines.cjs
│   │   │   │       ├── gitleaks.json
│   │   │   │       ├── line-coverage.json
│   │   │   │       ├── module-audit.json
│   │   │   │       ├── scan-report.html
│   │   │   │       ├── scan.json
│   │   │   │       └── summarize-coverage.py
│   │   │   └── history/
│   │   │       └── 2026-11-26-v1.8/
│   │   │           ├── code_quality.md
│   │   │           └── code_review.md
│   │   ├── account-management.md
│   │   ├── architecture.md
│   │   ├── code_quality.md
│   │   ├── code_review.md
│   │   ├── data_and_interfaces.md
│   │   ├── deployment.md
│   │   ├── development.md
│   │   ├── interview-agent-implementation.md
│   │   ├── interview-agent-v3.md
│   │   ├── personal-materials-implementation.md
│   │   ├── project-file-tree.md
│   │   ├── README.md
│   │   ├── repository_structure.md
│   │   └── voice-interview.md
│   └── README.md
├── tests/
│   ├── fixtures/
│   │   └── interview-cases.ts
│   ├── integration/
│   │   ├── database/
│   │   │   ├── agent-workflow.test.ts
│   │   │   ├── all-role-knowledge.test.ts
│   │   │   ├── auth.test.ts
│   │   │   ├── foundation.test.ts
│   │   │   ├── interview-cancellation.test.ts
│   │   │   ├── interviews.test.ts
│   │   │   ├── migrations.test.ts
│   │   │   ├── realtime.test.ts
│   │   │   └── voice-publication.test.ts
│   │   ├── process/
│   │   │   └── backend.test.ts
│   │   ├── web/
│   │   │   └── proxy.test.ts
│   │   ├── backend.test.ts
│   │   └── voice.test.ts
│   ├── support/
│   │   ├── agent-preview.ts
│   │   ├── agent-workflow-live.ts
│   │   ├── interview-policy-live.ts
│   │   ├── knowledge-all-live.ts
│   │   ├── knowledge-fixture.ts
│   │   ├── model-latency.ts
│   │   ├── report-wire.ts
│   │   ├── response-evidence-live.ts
│   │   ├── run-database-checks.ts
│   │   ├── test-database.ts
│   │   ├── voice-fixture.ts
│   │   └── voice-provider-smoke.ts
│   ├── unit/
│   │   ├── account-access.test.ts
│   │   ├── agent-workflow.test.ts
│   │   ├── analysis-state.test.ts
│   │   ├── catalog.test.ts
│   │   ├── entry-request.test.ts
│   │   ├── feedback-coverage.test.ts
│   │   ├── http-client.test.ts
│   │   ├── identity-contract.test.ts
│   │   ├── interview-entry.test.ts
│   │   ├── interview-experience.test.ts
│   │   ├── interview-jobs-client.test.ts
│   │   ├── interview-notices.test.ts
│   │   ├── interview-participation.test.ts
│   │   ├── interview-policy.test.ts
│   │   ├── interview-presentation.test.ts
│   │   ├── interview-realtime.test.ts
│   │   ├── interview-response.test.ts
│   │   ├── interview-setup.test.ts
│   │   ├── model-analysis.test.ts
│   │   ├── performance-profile.test.ts
│   │   ├── personal-auth.test.ts
│   │   ├── planning-context.test.ts
│   │   ├── presentation-request.test.ts
│   │   ├── question-scoring.test.ts
│   │   ├── report-insights.test.ts
│   │   ├── report-pages.test.ts
│   │   ├── report-readiness.test.ts
│   │   ├── report-rubric.test.ts
│   │   ├── report-visuals.test.ts
│   │   ├── reports.test.ts
│   │   ├── resume-template.test.ts
│   │   ├── review-conversation.test.ts
│   │   ├── scoring-evidence.test.ts
│   │   ├── setup-presentation.test.ts
│   │   ├── start-request.test.ts
│   │   ├── test-database.test.ts
│   │   ├── transition-screen.test.ts
│   │   ├── voice-client.test.ts
│   │   ├── voice-command.test.ts
│   │   ├── voice-interface.test.ts
│   │   ├── voice-session.test.ts
│   │   └── voice.test.ts
│   ├── interviewlab_demo_user_test.md
│   └── README.md
├── .dockerignore
├── .env.example
├── .gitattributes
├── .gitignore
├── compose.personal.yaml
├── Dockerfile.personal
├── package-lock.json
├── package.json
├── README.md
├── start-personal.command
└── tsconfig.json
```
