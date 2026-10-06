import { WorkspaceSurfacePage } from '../../control/surface-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Partnerportal · Croupier', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  return <WorkspaceSurfacePage surface="partner" path={(await params).path} />;
}
