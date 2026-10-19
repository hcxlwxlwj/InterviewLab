'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { Check, Code2, Play, X } from 'lucide-react';
import { Button } from './ui/button';
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => <div className="loading">正在加载编辑器…</div>,
});
type Language = 'cpp' | 'python' | 'java';
const initial = {
  python: 'def contains_duplicate(nums):\n    # 在这里编写你的实现\n    pass\n',
  cpp: '#include <vector>\nusing namespace std;\n\nbool containsDuplicate(vector<int>& nums) {\n    // 在这里编写你的实现\n    return false;\n}\n',
  java: 'class Solution {\n    public boolean containsDuplicate(int[] nums) {\n        // 在这里编写你的实现\n        return false;\n    }\n}\n',
};
export function CodeWorkspace({
  sessionId,
  disabled,
  theme,
  onClose,
  onSubmit,
}: {
  sessionId: string;
  disabled: boolean;
  theme: 'system' | 'light' | 'dark';
  onClose: () => void;
  onSubmit: (language: Language, code: string, revision: number) => void;
}) {
  const [language, setLanguage] = useState<Language>('python');
  const [drafts, setDrafts] = useState(initial);
  const [revision, setRevision] = useState(1);
  const [result, setResult] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`interviewlab-code-${sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const values = parsed.drafts ?? parsed;
        if (
          typeof values.python === 'string' &&
          typeof values.java === 'string' &&
          typeof values.cpp === 'string'
        ) {
          setDrafts(values);
          if (Number.isInteger(parsed.revision) && parsed.revision > 0)
            setRevision(parsed.revision);
        }
      }
    } catch {}
    setLoaded(true);
  }, [sessionId]);
  function change(value: string) {
    const next = { ...drafts, [language]: value };
    setDrafts(next);
    const nextRevision = revision + 1;
    setRevision(nextRevision);
    setSubmitted(false);
    try {
      sessionStorage.setItem(
        `interviewlab-code-${sessionId}`,
        JSON.stringify({ drafts: next, revision: nextRevision }),
      );
    } catch {}
  }
  return (
    <section className="code-workspace" aria-label="代码工作区">
      <div className="code-header">
        <h3>
          <Code2 size={16} />
          代码工作区
        </h3>
        <span className="badge badge-yellow">编辑演示</span>
        <button className="icon-button" onClick={onClose} aria-label="收起代码工作区">
          <X size={17} />
        </button>
      </div>
      <div className="code-task">
        <strong>示例题：数组中是否存在重复元素</strong>
        <p>给定整数数组，存在重复元素时返回 true，否则返回 false。</p>
        <code>输入：[1, 2, 3, 1]　期望：true</code>
        <p>此题为额外编辑演示，不计入口头问题数量或专业评分。</p>
      </div>
      <div className="code-languages" role="group" aria-label="代码语言">
        {(['python', 'cpp', 'java'] as Language[]).map((l) => (
          <button
            className={l === language ? 'selected' : ''}
            aria-pressed={l === language}
            key={l}
            onClick={() => {
              setLanguage(l);
              setSubmitted(false);
              setResult('');
            }}
          >
            {l === 'python' ? 'Python' : l === 'cpp' ? 'C++' : 'Java'}
          </button>
        ))}
        <span>各语言草稿分别保留</span>
      </div>
      {loaded && (
        <CodeMirror
          aria-label="代码编辑器"
          value={drafts[language]}
          height="210px"
          maxWidth="100%"
          theme={theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light'}
          extensions={[language === 'python' ? python() : language === 'cpp' ? cpp() : java()]}
          onChange={change}
          editable={!disabled}
          basicSetup={{ foldGutter: false }}
        />
      )}
      <div className="code-actions">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => setResult('服务不可用：未接入隔离执行服务，没有编译、运行或测试结果。')}
        >
          <Play size={13} />
          运行
        </Button>
        <Button
          size="sm"
          disabled={disabled || submitted}
          onClick={() => {
            onSubmit(language, drafts[language], revision);
            setSubmitted(true);
            setResult(`已记录 ${language.toUpperCase()} 草稿 v${revision}，未真实执行、未评审。`);
          }}
        >
          {submitted ? <Check size={13} /> : <Code2 size={13} />}
          {submitted ? '已记录草稿' : '提交演示草稿'}
        </Button>
        <span>未接入真实运行</span>
      </div>
      {result && (
        <p role="status" className="code-result">
          {result}
        </p>
      )}
    </section>
  );
}
