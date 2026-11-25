import Link from 'next/link';
import type { JobTemplate, PersonalMaterial } from '@interviewlab/core';

export function SetupJobSelection({
  jobs,
  value,
  disabled,
  onChange,
}: {
  jobs: JobTemplate[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor="job-direction">
        岗位方向
      </label>
      <select
        id="job-direction"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SelectedSetupJob({ job }: { job: Pick<JobTemplate, 'id' | 'title'> }) {
  return (
    <div className="field-group setup-selected-job">
      <div>
        <span className="field-label">目标岗位</span>
        <strong>{job.title}</strong>
      </div>
      <Link href="/jobs" className="text-link">
        更换岗位 →
      </Link>
    </div>
  );
}

export function SetupResumeSelection({
  materials,
  value,
  disabled,
  onChange,
}: {
  materials: PersonalMaterial[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <>
      <label className="field-label" htmlFor="interview-resume">
        选择简历（可选）
      </label>
      <select
        id="interview-resume"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">不使用简历</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>
            {material.title}
          </option>
        ))}
      </select>
      <Link href="/me/resumes" className="text-link setup-resume-link">
        管理简历 →
      </Link>
    </>
  );
}
