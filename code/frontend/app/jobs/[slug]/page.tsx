import { LiveJobDetail } from '../../../components/job-library';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LiveJobDetail id={slug} />;
}
