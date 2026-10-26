'use client';
import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Breadcrumb, Footer, Header } from './shared';

export function InterviewSetupPage({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="container page-body" id="main-content">
        <Breadcrumb items={['面试配置']} />
        <div className="page-heading">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span className="badge badge-mint">
            <ShieldCheck size={13} />
            设备默认关闭
          </span>
        </div>
        {children}
      </main>
      <Footer />
    </>
  );
}
export function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="field-group" disabled={disabled}>
      <legend className="field-label">{label}</legend>
      <div className="choices">
        {options.map((o) => (
          <label className="choice" key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
