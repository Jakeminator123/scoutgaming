// Operator lifecycle can change its package while leaving administration intact.
// Include both authorities; a stable read order is not itself a mutation.
export function lifecycleSnapshotKey(snapshot){
  const operators=snapshot.operators.map(row=>[row.id,row.packageRevision,row.status,row.archivedAt])
    .sort((left,right)=>left[0].localeCompare(right[0]));
  return JSON.stringify([snapshot.administrationRevision,operators]);
}
