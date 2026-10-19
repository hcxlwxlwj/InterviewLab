'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="empty-state">
      <h1>页面暂时没有加载成功</h1>
      <p>可以重新加载页面。演示数据保留在原标签页，请不要输入真实个人信息。</p>
      <button className="button button-primary" onClick={reset}>
        重新加载
      </button>
    </main>
  );
}
