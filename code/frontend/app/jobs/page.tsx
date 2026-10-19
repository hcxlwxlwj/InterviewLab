import { Suspense } from 'react';
import { JobLibrary } from '../../components/job-library';
export default function Page() {
  return (
    <Suspense>
      <JobLibrary />
    </Suspense>
  );
}
