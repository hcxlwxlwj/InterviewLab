'use client';
import { JOBS } from '@interviewlab/backend/content';
import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MessageCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Footer, Header, JobIcon } from '../components/shared';
import { Button } from '../components/ui/button';
export default function Home() {
  const [filter, setFilter] = useState('all');
  return (
    <>
      <Header />
      <main id="main-content" className="home-page">
        <section className="hero">
          <div className="hero-scene">
            <Image
              src="/images/interview-hero-wide.png"
              alt="暖黄色书桌场景，右侧是一台展示面试对话的浅青色笔记本电脑"
              fill
              priority
              sizes="100vw"
            />
            <div className="hero-product-preview" aria-hidden="true">
              <div className="product-preview-header">
                <span className="mini-brand">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>前端开发 · 项目深挖</strong>
                <span>界面预览</span>
              </div>
              <div className="product-preview-body">
                <div className="product-question-list">
                  <span className="avatar avatar-mint">面</span>
                  <strong>请介绍你参与的项目，以及你负责的部分。</strong>
                  <p className="product-question-selected">你具体做了哪些工作？</p>
                  <p>为什么选择这个方案？</p>
                  <p>你是如何验证结果的？</p>
                </div>
                <div className="product-conversation">
                  <div className="product-question">你在这个项目中，具体负责了什么？</div>
                  <p>我负责商品列表和搜索筛选，接口由同学实现。我们先约定字段，再验证主要流程。</p>
                  <div className="product-input">
                    输入你的回答
                    <span>
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="container hero-inner">
            <div className="hero-copy">
              <h1>
                把项目讲清楚，
                <br />
                让面试更从容。
              </h1>
              <p>
                从自己的项目出发，练习表达与追问。
                <br />
                为实习和校招，认真准备一次。
              </p>
              <div className="hero-actions">
                <Button asChild>
                  <Link href="/interview/setup">
                    开始模拟面试
                    <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/reports/sample-interview?demo=1">
                    <Play size={16} />
                    查看示例报告
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="container hero-bottom">
            <span>
              <FileText size={18} />
              <b>项目深挖</b>
            </span>
            <span>
              <MessageCircle size={18} />
              <b>技术问答</b>
            </span>
            <span>
              <RotateCcw size={18} />
              <b>面后复盘</b>
            </span>
          </div>
        </section>
        <section className="section container" id="directions">
          <div className="section-heading">
            <div>
              <h2>从目标岗位开始</h2>
            </div>
            <div className="filter-tabs" role="group" aria-label="筛选岗位">
              {[
                { id: 'all', title: '推荐方向' },
                { id: 'software', title: '软件开发' },
                { id: 'ai', title: 'AI 与大模型' },
                { id: 'product', title: '产品' },
              ].map((j) => (
                <button
                  key={j.id}
                  aria-pressed={filter === j.id}
                  className={filter === j.id ? 'selected' : ''}
                  onClick={() => setFilter(j.id)}
                >
                  {j.title}
                </button>
              ))}
            </div>
          </div>
          <div className="job-grid">
            {JOBS.filter((j) =>
              filter === 'all'
                ? [
                    'frontend',
                    'llm-app',
                    'ai-product',
                    'data-analysis',
                    'backend',
                    'sdet',
                  ].includes(j.id)
                : j.category_id === filter,
            )
              .slice(0, 8)
              .map((j) => (
                <Link href={`/jobs/${j.id}`} className="job-card" key={j.id}>
                  <span className="job-card-icon">
                    <JobIcon job={j.id} />
                  </span>
                  <h3>{j.title}</h3>
                  <p>{j.subtitle}</p>
                  <div className="job-card-bottom">
                    <div className="tags">
                      {j.tags.slice(0, 2).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <ArrowRight size={18} />
                  </div>
                </Link>
              ))}
          </div>
          <div className="catalog-home-link">
            <Link href="/jobs" className="text-link">
              查看全部 {JOBS.length} 个岗位模板 <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section className="feature-section" id="features">
          <div className="container feature-grid">
            <div className="feature-copy">
              <h2>
                知道哪里没讲清，
                <br />
                下次就能更具体。
              </h2>
              <p>
                把问题、原回答和复盘依据放在一起。
                <br />
                先找到一个缺口，再针对同一道题重新练习。
              </p>
              <Link className="text-link" href="/reports/sample-interview?demo=1">
                看看一份示例报告
                <ArrowRight size={17} />
              </Link>
            </div>
            <div className="report-preview">
              <div className="preview-top">
                <span>
                  <span className="status-dot" />
                  面试复盘
                </span>
                <span className="badge badge-peach">合成示例</span>
              </div>
              <div className="preview-question">
                <span className="muted small">01 / 项目经历</span>
                <h3>请具体说明你在项目中负责的部分。</h3>
                <p>“我主要负责商品列表、搜索筛选和发布表单，后端接口由另一位同学负责。”</p>
              </div>
              <div className="preview-insight">
                <ClipboardCheck size={20} />
                <div>
                  <strong>个人职责讲得很明确</strong>
                  <p>下一次，可以再讲一个具体的技术取舍，以及你如何验证它。</p>
                </div>
              </div>
              <div className="preview-footer">
                <span>依据：第 1 题回答原文</span>
                <Link href="/reports/sample-interview?demo=1">
                  查看完整示例
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="section container process-section">
          <div className="section-heading">
            <div>
              <h2>选好方向，就可以开始</h2>
            </div>
          </div>
          <div className="steps">
            {[
              { n: '01', title: '配置一场面试', text: '选择岗位、类型和时长，按需添加项目经历。' },
              { n: '02', title: '认真回答与追问', text: '围绕自己的经历作答，练习临场组织内容。' },
              { n: '03', title: '复盘，再试一次', text: '回看回答依据，挑一道题进行针对性重练。' },
            ].map((s) => (
              <div className="step" key={s.n}>
                <span>{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="container faq-section" id="faq">
          <div>
            <h2>你可能想知道</h2>
          </div>
          <div className="faq-list">
            {[
              {
                q: '没有实习经历，也可以练习吗？',
                a: '可以。课程项目、竞赛、科研和毕设都可以作为练习材料。重点是讲清自己的职责、行动与技术选择，不要求商业收益或上线规模。',
              },
              {
                q: '现在可以使用语音和上传简历吗？',
                a: '当前是交互演示版本，可通过文字体验完整流程，使用预置合成简历。真实语音、文件上传和模型服务尚未接入，不采集音视频。',
              },
              {
                q: '示例分数代表我的面试水平吗？',
                a: '不代表。示例报告展示的是固定合成案例。你在演示中提交的回答只用于体验流程，不会生成专业评分。',
              },
              {
                q: '练习记录会保存多久？',
                a: '演示记录仅保留在当前浏览器标签页，刷新可以恢复，关闭标签页后会清除。请勿输入真实简历或个人敏感信息。',
              },
            ].map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ArrowDown size={16} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="container bottom-cta">
          <div>
            <h2>下一次面试，从这次练习开始。</h2>
          </div>
          <Button asChild>
            <Link href="/interview/setup">
              开始模拟面试
              <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <Footer />
    </>
  );
}
