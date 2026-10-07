import { StudioPage } from '../../studio-page';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klippbibliotek · Croupier Studio' };
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <StudioPage view="videos" searchParams={props?.searchParams} />; }
