import { StudioPage } from '../../studio-page';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Talgranskning · Croupier Studio' };
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <StudioPage view="probe" searchParams={props?.searchParams} />; }
