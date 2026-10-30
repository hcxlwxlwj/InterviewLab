'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Code2,
  Database,
  FlaskConical,
  Info,
  Menu,
  UserRound,
  X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { readDemo, storageAvailable, type DemoState } from '../lib/demo-client';
import { useSession } from './session-provider';
import { AccountControls } from './account-controls';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="InterviewLab 首页">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        InterviewLab<small>面试练习室</small>
      </span>
    </Link>
  );
}
export function Header() {
  const path = usePathname();
  const { isDevelopment } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav aria-label="主导航" className={open ? 'main-nav is-open' : 'main-nav'}>
          <Link onClick={() => setOpen(false)} className={path === '/' ? 'active' : ''} href="/">
            首页
          </Link>
          <Link
            onClick={() => setOpen(false)}
            className={path.startsWith('/interview') ? 'active' : ''}
            href="/interview/setup"
          >
            模拟面试
          </Link>
          <Link
            onClick={() => setOpen(false)}
            className={path.startsWith('/jobs') ? 'active' : ''}
            href="/jobs"
          >
            岗位库
          </Link>
          <Link onClick={() => setOpen(false)} href="/#faq">
            常见问题
          </Link>
        </nav>
        <div className="header-actions">
          <span className="badge badge-yellow">
            {isDevelopment ? '面试流程联调' : '文字面试 Beta'}
          </span>
          <AccountControls />
          <Link href={isDevelopment ? '/me/interviews' : '/me'} className="user-link">
            <UserRound size={17} />
            <span>{isDevelopment ? '面试记录' : '个人中心'}</span>
            <ChevronRight size={14} />
          </Link>
          <button
            className="menu-toggle"
            aria-label={open ? '关闭导航' : '展开导航'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Brand />
        <p>每一次练习，都从自己的经历出发。</p>
        <span>真实文字面试 · 记录归属当前账号</span>
      </div>
    </footer>
  );
}
export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="breadcrumb">
      <Link href="/">首页</Link>
      {items.map((item, i) => (
        <span key={i}>
          <ChevronRight size={13} />
          {item}
        </span>
      ))}
    </div>
  );
}
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const update = () => setAvailable(storageAvailable());
    update();
    window.addEventListener('interviewlab-change', update);
    return () => window.removeEventListener('interviewlab-change', update);
  }, []);
  return (
    <div className={`notice ${compact ? 'notice-compact' : ''}`} role="note">
      <Info size={16} />
      <span>
        {available
          ? '旧版预设流程演示（不调用 AI）：请使用虚构内容。记录仅保留在当前标签页。'
          : '旧版预设流程演示（不调用 AI）：浏览器存储不可用，刷新后记录可能丢失。'}
        {!compact && ' 尚未接入真实评估。'}
      </span>
      <Link className="text-link" href="/interview/setup">
        进入 AI 面试 →
      </Link>
    </div>
  );
}
export function JobIcon({ job, size = 24 }: { job: string; size?: number }) {
  const Icon =
    job === 'frontend'
      ? Code2
      : ['backend', 'python', 'golang', 'database', 'data-warehouse', 'data-engineering'].includes(
            job,
          )
        ? Database
        : [
              'algorithm',
              'llm-app',
              'llm-training',
              'nlp',
              'cv',
              'speech',
              'recommendation',
              'ai-infra',
              'ai-product',
              'data-analysis',
            ].includes(job)
          ? BarChart3
          : FlaskConical;
  return <Icon size={size} />;
}
export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <BarChart3 size={28} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && (
        <Button asChild>
          <Link href={href}>
            {action ?? '开始一次练习'}
            <ArrowRight size={16} />
          </Link>
        </Button>
      )}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const original = previousFocus.current;
            const destination =
              original?.isConnected && original.tagName !== 'BODY'
                ? original
                : document.querySelector<HTMLElement>('main button, main a[href]');
            destination?.focus();
          }}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="关闭弹窗">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={description ? 'dialog-description' : 'sr-only'}>
            {description ?? title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function useDemoState(): DemoState | null {
  const [state, setState] = useState<DemoState | null>(null);
  useEffect(() => {
    const update = () => setState(readDemo());
    update();
    window.addEventListener('interviewlab-change', update);
    return () => window.removeEventListener('interviewlab-change', update);
  }, []);
  return state;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      正在准备页面…
    </div>
  );
}
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(iso));
}
export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
