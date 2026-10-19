import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main-content" className="empty-state">
      <h1>这个页面暂时找不到</h1>
      <p>请检查地址，或返回首页开始一次面试练习。</p>
      <Link className="button button-primary" href="/">
        返回首页
      </Link>
    </main>
  );
}
