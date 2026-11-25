'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { InterviewSetupPage } from '../../components/interview-setup';
import { interviewsApi } from '../../lib/api/interviews';
import { jobsApi } from '../../lib/api/jobs';
import { Loading } from '../../components/shared';
import { ErrorNotice, SessionGate, useLiveResource } from './common';
import { useInterviewFlow } from './flow-provider';
import { PreparationScreen } from './preparation';
import { useSetupConfiguration, type SetupConfigurationOptions } from './setup-controller';
import { SetupPanels } from './setup-panels';
import { SetupSummary } from './setup-summary';

function CatalogNotice({ error, retry }: { error: string; retry: () => void }) {
  return (
    <>
      <ErrorNotice message={error} retry={retry} />
      {!error && <Loading />}
      {error && (
        <Link href="/jobs" className="text-link">
          返回岗位库 →
        </Link>
      )}
    </>
  );
}

function Form({ jobId }: { jobId?: string }) {
  const flow = useInterviewFlow();
  const load = useCallback(
    async (signal: AbortSignal) =>
      jobId ? [await jobsApi.read(jobId, signal)] : (await interviewsApi.jobs(signal)).items,
    [jobId],
  );
  const jobs = useLiveResource(load, () => false);
  if (!jobs.value) return <CatalogNotice error={jobs.error} retry={() => void jobs.refresh()} />;
  const initialJob =
    jobs.value.find((job) => job.id === (jobId ?? flow.configuration?.job ?? 'frontend')) ??
    jobs.value[0];
  if (!initialJob)
    return <ErrorNotice message="暂无可用岗位，请稍后重试。" retry={() => void jobs.refresh()} />;
  return (
    <>
      <ErrorNotice message={jobs.error} retry={() => void jobs.refresh()} />
      <ConfigurationForm
        key={jobId ?? 'choose-job'}
        initialJob={initialJob}
        jobs={jobs.value}
        fixedJob={Boolean(jobId)}
        catalogError={jobs.error}
      />
    </>
  );
}

function ConfigurationForm(options: SetupConfigurationOptions) {
  const model = useSetupConfiguration(options);
  if (model.waiting) return <Loading />;
  if (model.preparing) return <PreparationScreen />;
  return (
    <form className="setup-grid" onSubmit={model.submit}>
      <SetupPanels model={model} {...options} />
      <SetupSummary model={model} />
    </form>
  );
}

export default function LiveSetup({ jobId }: { jobId?: string }) {
  return (
    <InterviewSetupPage title="配置模拟面试">
      <SessionGate>
        <Form jobId={jobId} />
      </SessionGate>
    </InterviewSetupPage>
  );
}
