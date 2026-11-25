import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  InterviewConfig,
  JobTemplate,
  PersonalMaterial,
  PersonalSettings,
} from '@interviewlab/core';
import { apiRequest } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { useLiveResource } from './common';
import { useInterviewFlow } from './flow-provider';
import {
  applyInterviewDefaults,
  initialInterviewConfiguration,
  selectInterviewJob,
} from './setup-state';

export interface SetupConfigurationOptions {
  initialJob: JobTemplate;
  jobs: JobTemplate[];
  fixedJob: boolean;
  catalogError: string;
}

function useConfigurationInputs(
  initialJob: JobTemplate,
  restored: InterviewConfig | null,
  jobs: JobTemplate[],
) {
  const [config, setConfig] = useState(() => initialInterviewConfiguration(initialJob, restored));
  const preserved = useRef(
    new Set<keyof InterviewConfig>(restored ? ['resume_ref', 'interviewer_style'] : []),
  );
  const change = <K extends keyof InterviewConfig>(key: K, value: InterviewConfig[K]) => {
    preserved.current.add(key);
    setConfig((current) => ({ ...current, [key]: value }));
  };
  const selectJob = (id: string) => {
    const job = jobs.find((item) => item.id === id);
    if (job) setConfig((current) => selectInterviewJob(current, job));
  };
  const preserveDefaults = () => {
    preserved.current.add('resume_ref');
    preserved.current.add('interviewer_style');
  };
  return { config, setConfig, preserved, change, selectJob, preserveDefaults };
}

function useResumeMaterials({
  setConfig,
  preserved,
  change,
}: ReturnType<typeof useConfigurationInputs>) {
  const [materials, setMaterials] = useState<PersonalMaterial[]>([]);
  const [materialError, setMaterialError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<PersonalMaterial[]>('/materials', { signal: controller.signal }),
      apiRequest<PersonalSettings>('/me/settings', { signal: controller.signal }),
    ])
      .then(([items, preferences]) => {
        if (controller.signal.aborted) return;
        setMaterials(items.filter((item) => item.kind === 'resume' && item.confirmed));
        const edited = new Set(preserved.current);
        setConfig((config) => applyInterviewDefaults(config, preferences, items, edited));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMaterialError('简历暂时无法加载，可不带简历继续通用面试。');
      });
    return () => controller.abort();
  }, [setConfig, preserved]);
  const selectResume = (id: string) => {
    const material = materials.find((item) => item.id === id);
    change('resume_ref', material ? { id: material.id, version: material.version } : undefined);
  };
  return { materials, materialError, selectResume };
}

function useSetupFlow(initialJob: JobTemplate, fixedJob: boolean) {
  const flow = useInterviewFlow();
  const differentFlow =
    fixedJob &&
    flow.phase !== 'idle' &&
    Boolean(flow.configuration && flow.configuration.job !== initialJob.id);
  useEffect(() => {
    if (differentFlow) flow.abandon();
  }, [differentFlow, flow.abandon]);
  return {
    flow,
    waiting: differentFlow,
    preparing: flow.phase !== 'idle' && flow.phase !== 'running',
  };
}

export function useSetupConfiguration(options: SetupConfigurationOptions) {
  const { flow, waiting, preparing } = useSetupFlow(options.initialJob, options.fixedJob);
  const input = useConfigurationInputs(options.initialJob, flow.configuration, options.jobs);
  const resume = useResumeMaterials(input);
  const { config, change, selectJob } = input;
  const load = useCallback(
    (signal: AbortSignal) => interviewsApi.profiles(config.job, config.career_stage, signal),
    [config.job, config.career_stage],
  );
  const profiles = useLiveResource(load, () => false);
  const blocked = flow.busy || Boolean(options.catalogError);
  const selected = options.jobs.find((job) => job.id === config.job);
  const canStart =
    !blocked &&
    Boolean(selected?.stages.includes(config.career_stage)) &&
    Boolean(profiles.value) &&
    !profiles.error;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canStart) return;
    input.preserveDefaults();
    void flow.begin(config);
  };
  return {
    config,
    change,
    selectJob,
    ...resume,
    profiles,
    busy: flow.busy,
    blocked,
    selected,
    canStart,
    submit,
    waiting,
    preparing,
  };
}

export type SetupConfiguration = ReturnType<typeof useSetupConfiguration>;
