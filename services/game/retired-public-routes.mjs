// Route classification for retired public paths. Pure, so the alias rules are
// unit-tested with both Windows and POSIX path semantics without a server.
import { normalize as platformNormalize } from 'node:path';

// `decoded` is the percent-decoded pathname. `path` stays platform-shaped for
// static files; `route` uses forward slashes so encoded \ and / aliases match.
export function publicRoutePaths(decoded, normalize = platformNormalize) {
  const path = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return { path, route: '/' + path.replace(/\\/g, '/').replace(/^\/+/, '') };
}
// Windows ignores directory casing and trailing dots/spaces; every alias of the
// retired BO generation package is still the retired package.
export const isRetiredGenerationRoute = route => /^\/bo[ .]*\/(?:gen[ .]*(?:\/|$)|generations[ .]*\.json[ .]*$)/i.test(route);
export const isRetiredLocalDealerRoute = route => /^\/(?:dealer[ .]*(?:\/|$)|dealers[ .]*\/(?:astrid|vera|amira|mei)[ .]*(?:\/|$))/i.test(route);
