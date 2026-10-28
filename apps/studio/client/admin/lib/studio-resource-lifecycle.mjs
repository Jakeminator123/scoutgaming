// Operator lifecycle can change its package while leaving administration intact.
// Include both authorities; a stable read order is not itself a mutation.
export function lifecycleSnapshotKey(snapshot){
  const operators=snapshot.operators.map(row=>[row.id,row.packageRevision,row.status,row.archivedAt])
    .sort((left,right)=>left[0].localeCompare(right[0]));
  return JSON.stringify([snapshot.administrationRevision,operators]);
}

export const isActiveOperator=row=>row.status==='active'&&!row.archivedAt;
export function operatorLifecycleGroups(operators){
  return {active:operators.filter(isActiveOperator),trash:operators.filter(row=>Boolean(row.archivedAt)),
    suspended:operators.filter(row=>row.status==='suspended'&&!row.archivedAt)};
}

// Bolag och spelbord: companies in the trash (archivedAt) and archived rooms are listed only under
// Papperskorg, and that tab's count is both together. Active and suspended companies stay under Bolag.
export function companyListGroups(operators,rooms){
  const companies=operators.filter(row=>!row.archivedAt),trashCompanies=operators.filter(row=>Boolean(row.archivedAt));
  const live=rooms.filter(row=>row.state!=='archived'),trashRooms=rooms.filter(row=>row.state==='archived');
  return {companies,trashCompanies,rooms:live,trashRooms,counts:{bolag:companies.length,spelbord:live.length,papperskorg:trashCompanies.length+trashRooms.length}};
}
