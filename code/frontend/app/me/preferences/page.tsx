import { Suspense } from 'react';
import PersonalWorkspace from '../../../components/personal-workspace';
export default function Page() {
  return (
    <Suspense>
      <PersonalWorkspace section="preferences" />
    </Suspense>
  );
}
