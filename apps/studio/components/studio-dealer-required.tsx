'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { studioNavigationContextFromQuery, studioNavigationHref } from '../lib/studio-navigation.mjs';
import { PageTemplate } from './page-template.mjs';
import { activeStudioDealers } from './studio-types';

export function StudioDealerRequired({ project, title }: { project: StudioProject; title: string }) {
  const pathname = usePathname(), query = useSearchParams();
  const context = studioNavigationContextFromQuery(query);
  const dealers = activeStudioDealers(project);
  return <PageTemplate eyebrow="// STUDIO" title={title}><div className="sg-page-body">
    <h2>Välj dealer</h2><p>Öppna den dealer du vill arbeta med. Varje dealer har egna klipp och inställningar.</p>
    <div className="sg-actions">{dealers.map(dealer => <a className="sg-btn sg-btn-secondary" key={dealer.id} href={studioNavigationHref(pathname, { ...context, dealerId: dealer.id })}>{dealer.label}</a>)}</div>
    {!dealers.length ? <p>Inga dealers har registrerats ännu.</p> : null}
    <p><a href={studioNavigationHref('/control/clips', { laneId: context.laneId, operatorId: context.operatorId, tableId: context.tableId })}>Hantera dealers och arkiv →</a></p>
  </div></PageTemplate>;
}
