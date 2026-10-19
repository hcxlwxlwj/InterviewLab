'use client';
import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { DemoNotice, Loading, Modal } from '../../components/shared';
import { TargetEditor, emptyTarget } from '../../components/target-editor';
import { Button } from '../../components/ui/button';
import { demoClient } from '../../lib/demo-client';

import { InterviewsSection } from './interviews';
import { OverviewSection } from './overview';
import { PreferencesSection } from './preferences';
import { ResumesSection } from './resumes';
import { SavedJobsSection } from './saved-jobs';
import { useWorkspaceController } from './use-workspace';
import { WorkspaceFrame, type PersonalSection } from './workspace-frame';
export default function PersonalWorkspace({ section = 'overview' }: { section?: PersonalSection }) {
  const workspace = useWorkspaceController(section);
  const {
    state,
    message,
    error,
    target,
    setTarget,
    bookmark,
    setBookmark,
    setSavedTab,
    deletion,
    setDeletion,
    renaming,
    setRenaming,
    act,
    confirmDelete,
    create,
    title,
  } = workspace;
  return (
    <WorkspaceFrame section={section}>
      <div className="workspace-heading">
        <div>
          <h1>{title}</h1>
          {section === 'overview' && <p>准备好自己的材料，把每一次练习留在这里。</p>}
        </div>
        {section === 'resumes' ? (
          <Button onClick={create}>
            <Plus size={18} />
            新建简历
          </Button>
        ) : section === 'saved-jobs' ? (
          <Button onClick={() => setTarget(emptyTarget())}>
            <Plus size={18} />
            新建个人 JD
          </Button>
        ) : (
          <Button asChild>
            <Link href="/interview/setup">
              开始模拟
              <ArrowRight size={18} />
            </Link>
          </Button>
        )}
      </div>
      <DemoNotice compact />
      {message && (
        <p className="toast-inline" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-inline" role="alert">
          {error}
        </p>
      )}
      {!state ? (
        <Loading />
      ) : (
        <>
          {section === 'overview' && <OverviewSection workspace={{ ...workspace, state }} />}
          {section === 'resumes' && <ResumesSection workspace={{ ...workspace, state }} />}
          {section === 'interviews' && <InterviewsSection workspace={{ ...workspace, state }} />}
          {section === 'saved-jobs' && <SavedJobsSection workspace={{ ...workspace, state }} />}
          {section === 'preferences' && <PreferencesSection workspace={{ ...workspace, state }} />}
          {target && (
            <TargetEditor
              key={target.id}
              target={target}
              resumes={state.resumes}
              onClose={() => {
                setTarget(null);
                setSavedTab('custom');
              }}
            />
          )}
          {bookmark && (
            <Modal
              open
              onOpenChange={(open) => {
                if (!open) setBookmark(null);
              }}
              title="收藏备注与常用简历"
            >
              <form
                className="library-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => {
                    demoClient.updateBookmark(
                      bookmark.template_id,
                      { notes: bookmark.notes, preferred_resume_id: bookmark.preferred_resume_id },
                      bookmark.version,
                    );
                    setBookmark(null);
                  }, '收藏已更新。');
                }}
              >
                <label>
                  备注
                  <textarea
                    maxLength={1000}
                    value={bookmark.notes}
                    onChange={(e) => setBookmark({ ...bookmark, notes: e.target.value })}
                  />
                </label>
                <label>
                  常用简历
                  <select
                    value={bookmark.preferred_resume_id ?? ''}
                    onChange={(e) =>
                      setBookmark({ ...bookmark, preferred_resume_id: e.target.value || undefined })
                    }
                  >
                    <option value="">默认简历</option>
                    {state.resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {error && <p role="alert">{error}</p>}
                <Button type="submit">保存收藏设置</Button>
              </form>
            </Modal>
          )}
        </>
      )}
      {deletion && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setDeletion(null);
          }}
          title={deletion.kind === 'reset' ? '重置全部演示数据？' : '确认删除？'}
          description={
            deletion.kind === 'resume'
              ? '将移除库内简历及所属经历，并清除目标岗位的简历关联。历史面试仍保留当时材料快照。'
              : deletion.kind === 'session'
                ? '将删除此面试和草稿，解除重练来源关联；独立重练记录保留。'
                : deletion.kind === 'target'
                  ? '删除个人JD不影响已经开始的面试。'
                  : '新增材料、收藏、记录与草稿将被清除。'
          }
        >
          <div className="row-actions">
            <Button variant="outline" onClick={() => setDeletion(null)}>
              取消
            </Button>
            <Button onClick={confirmDelete}>
              确认{deletion.kind === 'reset' ? '重置' : '删除'}
            </Button>
          </div>
        </Modal>
      )}
      {renaming && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(null);
          }}
          title="重命名简历"
        >
          <form
            className="library-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => {
                demoClient.renameResume(renaming.id, renaming.name);
                setRenaming(null);
              }, '简历已重命名。');
            }}
          >
            <label>
              简历名称
              <input
                required
                maxLength={100}
                value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button type="submit">保存名称</Button>
          </form>
        </Modal>
      )}
    </WorkspaceFrame>
  );
}
