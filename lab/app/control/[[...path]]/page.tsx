import { WorkspaceSurfacePage } from '../surface-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kontrollpanel · Croupier', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  return <WorkspaceSurfacePage surface="control" path={(await params).path} />;
}
