const OWNED = ['tables', 'team', 'presentations', 'players', 'transactions', 'reports'];

export function validatePartnerSnapshot(snapshot) {
  if (!snapshot || snapshot.preview !== false) throw Error('En verklig partnerarbetsyta krävs.');
  if (!snapshot.operator?.id || !Array.isArray(snapshot.operators) || !snapshot.operators.some(operator => operator.id === snapshot.operator.id)) throw Error('Arbetsytans operatör saknas.');
  for (const key of OWNED) {
    if (!Array.isArray(snapshot[key]) || snapshot[key].some(item => item?.operatorId && item.operatorId !== snapshot.operator.id)) {
      throw Error('Arbetsytan innehåller fel operatörskontext.');
    }
  }
  return snapshot;
}

export function operatorPackageRevision(snapshot) {
  const candidates = [snapshot?.operator?.packageRevision, snapshot?.packageRevision, snapshot?.operatorPackage?.revision, snapshot?.package?.revision];
  const value = candidates.find(item => typeof item === 'string' && item.trim());
  return value ? value.trim() : '';
}

export function createPartnerWorkspaceContext(snapshot, { surface, user, notify, teamView }) {
  validatePartnerSnapshot(snapshot);
  if (surface !== 'partner') throw Error('Okänd yta.');
  if (snapshot.viewer?.user && snapshot.viewer.user !== user) throw Error('Operatörskontot har ändrats. Ladda om och logga in igen.');
  return { snapshot, surface, user, notify, teamView: typeof teamView === 'function' ? teamView : null };
}
