// In-memory answers to the operator store's tagged reads, inside the bound scope.
// Only the two reads used by the game entry exist; any other query fails.
export function operatorRow(scope, id, slug, status = 'active') {
  return { environment_id: scope.environment, workspace_id: scope.workspaceId, operator_id: id, slug, name: `Operator ${id}`, status, created_at_ms: 1 };
}

export function packageRow(scope, id, revision, lanes, branding = '{}') {
  return { environment_id: scope.environment, workspace_id: scope.workspaceId, operator_id: id, package_revision: revision,
    lanes: JSON.stringify(lanes), games: '["blackjack"]', tables: '[]', branding, published_at_ms: 10 + revision };
}

export function operatorPackageSql({ operators = [], packages = [] } = {}) {
  const calls = [];
  const state = { fail: null, delayMs: 0 };
  async function sql(text, values) {
    const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
    calls.push(tag ?? 'untagged');
    if (!tag) throw new Error('untagged query');
    if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs));
    if (state.fail) throw state.fail;
    const [environment, workspace] = values;
    const scoped = rows => rows.filter(row => row.environment_id === environment && row.workspace_id === workspace);
    if (tag === 'operator-by-slug') return scoped(operators).filter(row => row.slug === values[2]).map(row => ({ ...row }));
    if (tag === 'current-package') return scoped(packages).filter(row => row.operator_id === values[2])
      .sort((a, b) => b.package_revision - a.package_revision).slice(0, 1).map(row => ({ ...row }));
    throw new Error(`unexpected query ${tag}`);
  }
  return { sql, calls, state };
}
