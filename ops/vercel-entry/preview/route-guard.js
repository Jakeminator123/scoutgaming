// This classic script runs before the game module. The pilot only supports
// Astrid's local presentation, including direct visits and edited URLs.
const query = new URLSearchParams(location.search);
if (query.get('dealer') !== 'astrid' || query.get('presentation') !== 'local'
  || [...query.keys()].some(key => key !== 'dealer' && key !== 'presentation')) {
  location.replace('/frontend-preview/game/?dealer=astrid&presentation=local');
}
