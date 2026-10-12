import {isActiveDealerId} from '../../web/dealer-identity.mjs';
import { validatePublicOperatorRooms } from '../../web/public/operator-rooms-contract.mjs';

// Only names and identifiers cross the server/client boundary; no media or draft bodies.
export function controlStudioSummary(project) {
  if (!project || !Array.isArray(project.dealers) || !Array.isArray(project.lanes)) return null;
  return { dealers: project.dealers.filter(({id})=>isActiveDealerId(id)).map(({ id, label }) => ({ id, label })),
    lanes: project.lanes.map(({ id, label }) => ({ id, label })) };
}

export function selectedOverviewOperator(operators, query) {
  return operators.find(item => item.id === query || item.slug === query) ?? operators[0];
}

export function overviewNextStep({ operatorStatus, operator, studio, status, data }) {
  if (operatorStatus === 'unavailable') return { kind: 'retry', title: 'Läs in bolagen igen', text: 'Bolagslistan kunde inte hämtas. Ingen publiceringsstatus kan visas förrän anslutningen fungerar.', label: 'Ladda om översikten' };
  if (operatorStatus === 'demo') return { kind: 'studio', title: 'Utforska arbetsflödet', text: 'Du ser demonstrationsbolag. Här visas ingen bekräftad publicering eller driftstatus.', label: 'Öppna Dealers & klipp' };
  if (!operator) return { kind: 'company', title: 'Börja med ett bolag', text: 'Skapa bolaget och välj vilka som ska arbeta med det. Sedan kan du publicera en sammansättning och öppna ett spelrum.', label: 'Skapa bolag' };
  if (status === 'error') return { kind: 'retry', title: 'Kontrollera bolagets status', text: 'Spellobbyns uppgifter kunde inte hämtas. Ett anslutningsfel betyder inte att bolaget saknar spelrum.', label: 'Försök igen' };
  if (status !== 'ready' || !data) return { kind: 'loading', title: 'Hämtar bolagets publicering', text: 'Kontrollerar vilka spelrum och dealers som är tillgängliga i bolagets spellobby.', label: 'Kontrollerar…' };
  if (operator.publishedPackage !== undefined && (operator.publishedPackage?.revision ?? null) !== data.packageRevision) return { kind: 'retry', title: 'Publiceringen har ändrats', text: 'Bolagets paket har uppdaterats sedan sidan öppnades. Läs in översikten igen för en aktuell bild.', label: 'Ladda om översikten' };
  if (data.rooms.length) return { kind: 'play', title: 'Se det spelaren ser', text: 'Bolaget har öppna spelrum. Öppna lobbyn och kontrollera den publicerade sammansättningen. Ändringar i Studio visas först efter publicering.', label: 'Öppna bolagets spellobby' };
  if (!data.packageRevision && studio?.lanes.length === 0) return { kind: 'composition', title: 'Sätt ihop den första sammansättningen', text: 'Välj dealer och hur bord och bakgrund ska visas. Spara sammansättningen innan du skapar bolagets första spelrum.', label: 'Öppna Sammansättning' };
  return { kind: 'publish', title: data.packageRevision ? 'Öppna ett spelrum för bolaget' : 'Publicera bolagets första spelrum', text: 'Välj en sparad sammansättning och ge spelrummet ett namn. Sammansättningen publiceras och kopplas till rummet i samma steg.', label: 'Till Spelrum & publicering' };
}

// Per mounted overview; no shared company cache, polling or write requests.
export function createOverviewReader({ fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  let snapshot = Object.freeze({ key: null, status: 'idle', data: null });
  let ticket = 0, abort;
  const listeners = new Set();
  const emit = next => { snapshot = Object.freeze(next); for (const listener of listeners) listener(); };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    cancel() { ticket++; abort?.abort(); },
    async read(operatorSlug) {
      const own = ++ticket; abort?.abort(); abort = new AbortController();
      const signal = abort.signal;
      emit({ key: operatorSlug, status: 'loading', data: null });
      const timer = setTimeout(() => abort?.signal === signal && abort.abort(), timeoutMs);
      try {
        const response = await fetchImpl('/api/operators/' + encodeURIComponent(operatorSlug) + '/rooms',
          { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal, headers: { accept: 'application/json' } });
        if (!response.ok) throw Error('unavailable');
        const data = validatePublicOperatorRooms(await response.json(), { operatorSlug });
        if (own === ticket) emit({ key: operatorSlug, status: 'ready', data });
      } catch {
        if (own === ticket) emit({ key: operatorSlug, status: 'error', data: null });
      } finally { clearTimeout(timer); }
    },
  };
}
