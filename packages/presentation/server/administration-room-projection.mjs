import { checkPackageRooms } from '../contracts/package-rooms.mjs';
import { StudioStorageError, canonicalStudioJson } from '../../studio-registry/server/storage-contract.mjs';

const corrupt = () => { throw new StudioStorageError('studio_corrupt_operator', 503); };
const json = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { corrupt(); } };

// The Admin DTO keeps its rooms field for clients. It is a projection of the
// latest packages in this exact scope, never a second stored room registry.
export async function readAdministrationRooms(query) {
  const result = await query(`/* studio:current-package-rooms */
    SELECT DISTINCT ON (operator_id) operator_id,package_revision,lanes,tables,rooms
    FROM croupier_studio.operator_packages
    WHERE environment_id=$1 AND workspace_id=$2
    ORDER BY operator_id,package_revision DESC`);
  const rooms = [], ids = new Set();
  for (const row of result.rows) {
    if (row.rooms === null || row.rooms === undefined) throw new StudioStorageError('studio_package_rooms_migration_required', 503);
    const checked = checkPackageRooms({ operatorId: row.operator_id, tables: json(row.tables), lanes: json(row.lanes), rooms: json(row.rooms) });
    if (!checked) corrupt();
    for (const room of checked) {
      if (ids.has(room.id) || rooms.length >= 1000) corrupt();
      ids.add(room.id); rooms.push(room);
    }
  }
  return rooms;
}
export function withoutAdministrationRooms(value) {
  const { rooms: _rooms, ...stored } = value;
  return stored;
}
export function sameAdministrationRooms(left, right) {
  const ordered = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return Array.isArray(left) && Array.isArray(right)
    && canonicalStudioJson(ordered(left)) === canonicalStudioJson(ordered(right));
}
export const administrationRooms = Object.freeze({ read: readAdministrationRooms, store: withoutAdministrationRooms, same: sameAdministrationRooms });
