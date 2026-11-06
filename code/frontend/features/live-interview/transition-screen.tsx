'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface TransitionStep {
  label: string;
  state: 'pending' | 'active' | 'done' | 'error';
}

export interface TransitionScreenProps {
  kind: 'preparing' | 'analysis';
  title: string;
  description: string;
  detail?: string;
  steps: TransitionStep[];
  progress?: { value: number; max: number };
  error?: string;
  children?: ReactNode;
  context?: string;
}

/** Values describe completed work, never elapsed-time estimates. */
export function TransitionScreen({
  kind,
  title,
  description,
  detail,
  steps,
  progress,
  error,
  children,
  context,
}: TransitionScreenProps) {
  const titleId = useId();
  const screen = useRef<HTMLElement>(null);
  const completed = steps.filter((step) => step.state === 'done').length;
  const measured =
    progress && Number.isFinite(progress.max) && progress.max > 0 && Number.isFinite(progress.value)
      ? { max: progress.max, value: Math.min(progress.max, Math.max(0, progress.value)) }
      : steps.length
        ? { max: steps.length, value: completed }
        : null;
  const active = steps.find((step) => step.state === 'active');
  const stage = error
    ? '需要处理后继续'
    : (active?.label ??
      (completed === steps.length && steps.length
        ? kind === 'analysis'
          ? '报告已就绪'
          : '准备就绪'
        : description));

  useEffect(() => {
    const element = screen.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.focus({ preventScroll: true });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !element) return;
      const targets = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ).filter((target) => !target.hidden && target.getAttribute('aria-hidden') !== 'true');
      const first = targets[0],
        last = targets.at(-1);
      if (!first || !last) {
        event.preventDefault();
        element.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    element?.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      element?.removeEventListener('keydown', trapFocus);
      if (previousFocus?.isConnected && element?.contains(document.activeElement))
        previousFocus.focus();
    };
  }, []);

  return (
    <section
      ref={screen}
      className={`interview-transition interview-transition--${kind}${error ? ' interview-transition--error' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className="interview-transition__wordmark" aria-hidden="true">
        InterviewLab
      </div>
      <div className="interview-transition__content">
        <div className="interview-transition__illustration" aria-hidden="true">
          <span className="interview-transition__halo" />
          <span className="interview-transition__shadow" />
          <div className="interview-transition__float">
            <span className="interview-transition__belt interview-transition__belt--back" />
            <div className="interview-transition__orb">
              <span className="interview-transition__surface" />
              <span className="interview-transition__sheen" />
            </div>
            <span className="interview-transition__belt interview-transition__belt--front" />
            <i className="interview-transition__dot interview-transition__dot--one" />
            <i className="interview-transition__dot interview-transition__dot--two" />
            <i className="interview-transition__dot interview-transition__dot--three" />
          </div>
        </div>
        <h1 id={titleId}>{title}</h1>
        <p
          className={`interview-transition__status${error ? ' interview-transition__status--error' : ''}`}
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {error || description}
        </p>
        {context && <p className="interview-transition__context">{context}</p>}
        <div
          className="interview-transition__track"
          role="progressbar"
          aria-label={kind === 'preparing' ? '面试准备进度' : '报告分析进度'}
          aria-valuemin={measured ? 0 : undefined}
          aria-valuemax={measured?.max}
          aria-valuenow={measured?.value}
          aria-valuetext={[
            measured ? `${stage}，已完成 ${measured.value} / ${measured.max}` : stage,
            detail,
          ]
            .filter(Boolean)
            .join('。')}
        >
          <span
            className="interview-transition__fill"
            style={{ width: measured ? `${(measured.value / measured.max) * 100}%` : '0%' }}
          />
          {active && !error && <span className="interview-transition__shimmer" />}
        </div>
        {children && <div className="interview-transition__actions">{children}</div>}
      </div>
    </section>
  );
}
