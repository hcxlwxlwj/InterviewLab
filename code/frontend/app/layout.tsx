import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SessionProvider } from '../components/session-provider';
import './globals.css';
import './workspace.css';
import './refinement.css';
import './library.css';
import './auth.css';
const uiFont = localFont({
  src: '../public/fonts/interviewlab-sans.woff2',
  variable: '--font-ui',
  weight: '100 900',
  display: 'swap',
  preload: true,
});
export const metadata: Metadata = {
  title: { default: 'InterviewLab · 面试练习室', template: '%s · InterviewLab' },
  description: '从自己的项目出发，练习面试表达、应对追问，在复盘中找到下一次进步的方向。',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" className={uiFont.variable}>
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
