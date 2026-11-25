import { interviewDurationMinutes, type Interview, type InterviewPreview } from '@interviewlab/core';
import { Button } from '../../components/ui/button';

export function InterviewProgressNotice({
  view,
  continuation,
  targetReached,
  canContinue,
  onContinue,
  canExtend,
  onExtend,
  onFinish,
}: {
  view: Interview;
  continuation: boolean;
  targetReached: boolean;
  canContinue: boolean;
  onContinue: () => void;
  canExtend: boolean;
  onExtend: () => void;
  onFinish: () => void;
}) {
  return (
    <>
      {continuation && (
        <p className="notice" role="status">
          {view.generation_status === 'failed'
            ? '回答已保存。可继续补充回答，或 '
            : '旧问题生成已被你的补充打断。可继续补充回答，或 '}
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
        <div className="notice" role="status">
          <span>
            已到设定的 {view.configuration.duration_minutes} 分钟。如果还在回答，可以先把当前问题讲完；
            也可以继续面试或结束查看报告。
          </span>
          <button className="text-link" disabled={!canExtend} onClick={onExtend}>
            继续 5 分钟
          </button>
          <button className="text-link" disabled={!canExtend} onClick={onFinish}>
            结束并查看报告
          </button>
          <span>
            {Math.max(10, interviewDurationMinutes(view)) + 2} 分钟（含暂停和断线）后会自动封存。
          </span>
        </div>
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
