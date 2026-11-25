import type { Interview, InterviewPreview } from '@interviewlab/core';
import { Button } from '../../components/ui/button';

export function InterviewProgressNotice({
  view,
  continuation,
  targetReached,
  canContinue,
  onContinue,
}: {
  view: Interview;
  continuation: boolean;
  targetReached: boolean;
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      {continuation && (
        <p className="notice" role="status">
          旧问题生成已被你的补充打断。可继续补充回答，或{' '}
          <button className="text-link" disabled={!canContinue} onClick={onContinue}>
            按已保存的回答继续提问
          </button>
          。
        </p>
      )}
      {view.participation && (
        <p className="notice" role="status">
          {view.participation.message}
        </p>
      )}
      {view.retry_goal && <p className="notice">单题重练目标：{view.retry_goal}</p>}
      {targetReached && (
        <p className="notice" role="status">
          已到目标时长，请完成当前回答后收尾。
          {Math.max(10, view.configuration.duration_minutes) + 2}{' '}
          分钟后会自动封存，暂停和断线仍计时。
        </p>
      )}
    </>
  );
}

export function InterviewGenerationNotice({
  view,
  preview,
  blocked,
  onRetry,
}: {
  view: Interview;
  preview: InterviewPreview | null;
  blocked: boolean;
  onRetry: (fallback: boolean) => void;
}) {
  const waiting = view.turns.at(-1)?.answer_status === 'waiting';
  return (
    <>
      {preview && (
        <div className="message message-interviewer" aria-live="polite">
          <p>{preview.acknowledgement}</p>
          <p>{preview.text}</p>
          <small>生成中，完成后即可回答</small>
        </div>
      )}
      {view.generation_status === 'pending' && !preview && (
        <p className="notice" role="status">
          回答已保存，面试官正在结合你的陈述思考…
        </p>
      )}
      {view.generation_status === 'failed' && (
        <div className="notice" role="status">
          <span>生成暂时失败，已保存的回答仍保留。</span>
          <Button size="sm" disabled={blocked} onClick={() => onRetry(false)}>
            重试生成
          </Button>
          <Button size="sm" variant="outline" disabled={blocked} onClick={() => onRetry(true)}>
            {waiting ? '保留原题继续作答' : '使用通用流程题继续'}
          </Button>
        </div>
      )}
    </>
  );
}
