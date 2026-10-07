import { StudioPage } from '../../studio-page';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Händelser · Croupier Studio' };
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <StudioPage view="lab" searchParams={props?.searchParams} />; }
