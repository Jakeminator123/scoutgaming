// Utkastkedjan för branding-API:ts prov ovanpå ett enkelt paketlager ({getCurrentPackage, publishPackage}).
// Samma CAS som operator-store (packages/operators/server/operator-store.mjs, changeBrandingDraft):
// expectedPackageRevision och expectedDraftRevision ska stämma, publicering bara från ett eget,
// opublicerat utkast mot samma paketrevision, och varje sparning och publicering räknar upp utkastet.
// Publiceringen går genom lagrets egen publishPackage, så att provens räknare och lås gäller.
const conflict = () => { throw Object.assign(Error('studio_conflict'), { statusCode: 409 }); };

export function withBrandingDrafts(store) {
  const drafts = new Map(), packages = new Map();
  const remember = pack => {
    if (pack) packages.set(`${pack.operatorId}:${pack.revision}`, structuredClone(pack));
    return pack;
  };
  const journal = operatorId => { if (!drafts.has(operatorId)) drafts.set(operatorId, []); return drafts.get(operatorId); };
  async function change(input, publish) {
    const pack = remember(await store.getCurrentPackage(input.operatorId)), rows = journal(input.operatorId), before = rows.at(-1) ?? null;
    if (pack?.revision !== input.expectedPackageRevision || (before?.revision ?? 0) !== input.expectedDraftRevision) conflict();
    if (publish && (!before || before.action === 'draft.publish' || before.basePackageRevision !== input.expectedPackageRevision)) conflict();
    const row = { operatorId: input.operatorId, revision: (before?.revision ?? 0) + 1, basePackageRevision: input.expectedPackageRevision, updatedAt: rows.length + 1 };
    if (!publish) {
      const source = input.sourcePackageRevision ?? null;
      const draft = { ...row, branding: structuredClone(input.branding), sourcePackageRevision: source, publishedPackageRevision: null,
        action: source ? 'draft.restore' : 'draft.save' };
      rows.push(draft);
      return structuredClone(draft);
    }
    const saved = remember(await store.publishPackage({ actor: input.actor, ...(input.audit ? { audit: input.audit } : {}), operatorId: input.operatorId,
      expectedRevision: pack.revision, lanes: [...pack.lanes], games: [...pack.games], tables: [...pack.tables], branding: structuredClone(input.branding) }));
    const draft = { ...row, branding: structuredClone(before.branding), sourcePackageRevision: null, publishedPackageRevision: saved.revision, action: 'draft.publish' };
    rows.push(draft);
    return { package: structuredClone(saved), draft: structuredClone(draft) };
  }
  return {
    ...store,
    async getPackage(operatorId, revision) {
      const current = remember(await store.getCurrentPackage(operatorId));
      return current?.revision === revision ? current : structuredClone(packages.get(`${operatorId}:${revision}`) ?? null);
    },
    async listPackages(operatorId, { limit = 20 } = {}) {
      remember(await store.getCurrentPackage(operatorId));
      return [...packages.values()].filter(pack => pack.operatorId === operatorId).sort((a, b) => b.revision - a.revision).slice(0, limit).map(pack => structuredClone(pack));
    },
    async getBrandingDraft(operatorId) { const row = journal(operatorId).at(-1); return row ? structuredClone(row) : null; },
    saveBrandingDraft: input => change(input, false),
    publishBrandingDraft: input => change(input, true),
  };
}

// Det som write() en gång gjorde i ett steg går nu genom bolagets utkast: spara, granska, publicera med granskningens token.
// `branding` är hela den redigerbara ytan (PARTNER_BRANDING_FIELDS och roomOverrides), inte en ändring ovanpå paketet.
export async function publishThroughDraft(api, { operatorId, actor = 'partner', audit, branding, expectedPackageRevision, expectedDraftRevision = 0 }) {
  const base = { operatorId, actor, ...(audit ? { audit } : {}), expectedPackageRevision };
  await api.command({ ...base, action: 'save-draft', expectedDraftRevision, branding });
  const review = await api.command({ ...base, action: 'review', expectedDraftRevision: expectedDraftRevision + 1 });
  return api.command({ ...base, action: 'publish', expectedDraftRevision: expectedDraftRevision + 1, reviewToken: review.reviewToken });
}
