'use client';
import { getJob } from '@interviewlab/content';
import { templateJd, type JobBookmark, type JobTarget } from '@interviewlab/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDemoState } from '../../components/shared';
import { emptyTarget } from '../../components/target-editor';
import { deleteDemoSession, demoClient } from '../../lib/demo-client';

import { navigation, type PersonalSection } from './workspace-frame';
export function useWorkspaceController(section: PersonalSection) {
  const state = useDemoState(),
    router = useRouter(),
    search = useSearchParams();
  const [query, setQuery] = useState(''),
    [job, setJob] = useState(''),
    [resume, setResume] = useState(''),
    [status, setStatus] = useState(''),
    [period, setPeriod] = useState(''),
    [page, setPage] = useState(0);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [target, setTarget] = useState<JobTarget | null>(null),
    [bookmark, setBookmark] = useState<JobBookmark | null>(null),
    [savedTab, setSavedTab] = useState<'templates' | 'custom'>('templates');
  const [deletion, setDeletion] = useState<{
    kind: 'resume' | 'session' | 'target' | 'reset';
    id: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const tab = search.get('tab');
    const old: Record<string, string> = {
      records: 'interviews',
      resumes: 'resumes',
      preferences: 'preferences',
    };
    if (section === 'overview' && tab && old[tab]) router.replace(`/me/${old[tab]}`);
  }, [search, router, section]);
  const copyParam = search.get('create');
  useEffect(() => {
    if (section !== 'saved-jobs' || !copyParam) return;
    const j = getJob(copyParam);
    if (j) {
      setTarget({
        ...emptyTarget(j.id),
        title: j.title,
        jd_text: templateJd(j),
        source_kind: 'template_copy',
        template_id: j.id,
        template_version: j.version,
      });
      setSavedTab('custom');
    } else setError('岗位模板已不可用。');
    router.replace('/me/saved-jobs', { scroll: false });
  }, [copyParam, section, router]);
  function act(fn: () => void, success?: string) {
    try {
      fn();
      setError('');
      if (success) setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function confirmDelete() {
    if (!deletion) return;
    act(
      () => {
        if (deletion.kind === 'resume') demoClient.deleteResume(deletion.id);
        if (deletion.kind === 'session') deleteDemoSession(deletion.id);
        if (deletion.kind === 'target') demoClient.deleteJobTarget(deletion.id);
        if (deletion.kind === 'reset') demoClient.reset();
        setDeletion(null);
        setPage(0);
      },
      deletion.kind === 'reset' ? '已恢复初始演示数据。' : '已删除，历史面试快照保持原样。',
    );
  }
  function create() {
    act(() => {
      const r = demoClient.createResume('未命名简历');
      router.push(`/me/resumes/${r.id}`);
    });
  }
  const title =
    section === 'overview' ? '我的工作区' : navigation.find((n) => n.id === section)!.title;
  const filteredResumes =
    state?.resumes.filter((r) =>
      [r.name, getJob(r.target_job ?? '')?.title]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  const records =
    state?.sessions.filter(
      (s) =>
        (!job || s.configuration.job === job) &&
        (!resume || s.material_snapshot.resume?.id === resume) &&
        (!status || s.status === status) &&
        (!period || Date.parse(s.started_at) >= Date.now() - Number(period) * 86400000),
    ) ?? [];
  const resumeOptions = state
    ? [
        ...new Map([
          ...state.sessions.flatMap((s) =>
            s.material_snapshot.resume
              ? [[s.material_snapshot.resume.id, s.material_snapshot.resume.name] as const]
              : [],
          ),
          ...state.resumes.map((r) => [r.id, r.name] as const),
        ]).entries(),
      ]
    : [];
  const queryLower = query.trim().toLowerCase();

  return {
    state,
    router,
    query,
    setQuery,
    job,
    setJob,
    resume,
    setResume,
    status,
    setStatus,
    period,
    setPeriod,
    page,
    setPage,
    message,
    setMessage,
    error,
    setError,
    target,
    setTarget,
    bookmark,
    setBookmark,
    savedTab,
    setSavedTab,
    deletion,
    setDeletion,
    renaming,
    setRenaming,
    act,
    confirmDelete,
    create,
    title,
    filteredResumes,
    records,
    resumeOptions,
    queryLower,
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspaceController>;
export type LoadedWorkspace = WorkspaceModel & { state: NonNullable<WorkspaceModel['state']> };
