'use client';
import { Bookmark, FileText, FolderOpen, LayoutDashboard, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { Footer, Header } from '../../components/shared';

export type PersonalSection = 'overview' | 'resumes' | 'interviews' | 'saved-jobs' | 'preferences';
export const navigation = [
  { id: 'overview', title: '概览', Icon: LayoutDashboard, href: '/me' },
  { id: 'resumes', title: '我的简历', Icon: FileText, href: '/me/resumes' },
  { id: 'interviews', title: '面试记录', Icon: FolderOpen, href: '/me/interviews' },
  { id: 'saved-jobs', title: '目标岗位', Icon: Bookmark, href: '/me/saved-jobs' },
  { id: 'preferences', title: '偏好设置', Icon: Settings2, href: '/me/preferences' },
];
export function WorkspaceFrame({
  section,
  children,
}: {
  section: PersonalSection;
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" className="container workspace-layout">
        <aside className="workspace-nav">
          <h2>个人中心</h2>
          <nav aria-label="个人中心导航">
            {navigation.map((n) => (
              <Link key={n.id} href={n.href} aria-current={section === n.id ? 'page' : undefined}>
                <n.Icon size={20} />
                {n.title}
              </Link>
            ))}
          </nav>
          <p>
            简历、目标与练习，
            <br />
            放在同一个地方。
          </p>
        </aside>
        <div className="workspace-content">{children}</div>
      </main>
      <Footer />
    </>
  );
}
