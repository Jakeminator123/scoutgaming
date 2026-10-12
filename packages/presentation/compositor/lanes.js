// UI for local named scenes. Save serialisation lives in app.js.
export function installLaneUI({getScene, setScene, getCatalog, api, save, refresh, upload, handle, toast}) {
  const $ = id => document.getElementById(id);
  let currentId = null;
  function render() {
    $('lane-name').value = getScene().name;
    $('lane-select').replaceChildren(new Option('Välj en sparad lane…', ''));
    for (const lane of getCatalog().lanes || []) $('lane-select').add(new Option(lane.name, lane.id));
    $('lane-select').value = currentId || '';
    $('lane-current').textContent = currentId ? 'Öppen sparad lane · Spara lane uppdaterar den' : 'Arbetsutkast · Spara lane skapar den första kopian';
  }
  $('lane-name').onchange = handle(async () => { getScene().name = $('lane-name').value.trim() || 'Min lane'; await save(); });
  async function saveNamed(asCopy) {
    getScene().name = $('lane-name').value.trim() || 'Min lane';
    await save();
    const lane = await api('lane', {scene: getScene(), id: asCopy ? null : currentId, parent: asCopy ? currentId : null});
    currentId = lane.id;
    await setScene(lane.scene); await save(); await refresh(); render();
    toast(asCopy ? 'Ny lane-kopia sparad. Grundscenen finns kvar.' : 'Lane och passning sparade lokalt.');
  }
  $('lane-save').onclick = handle(() => saveNamed(false));
  $('lane-copy').onclick = handle(() => saveNamed(true));
  $('lane-open').onclick = handle(async () => {
    const id = $('lane-select').value;
    if (!id) return;
    if (!confirm('Öppna denna lane? Arbetsutkastet ersätts. Spara det som lane först om du vill behålla det.')) return;
    await save();
    const lane = await api('lane?id=' + encodeURIComponent(id));
    await setScene(lane.scene); currentId = lane.id;
    await save(); await refresh(); render();
  });
  $('lane-import').onclick = () => $('lane-input').click();
  $('lane-input').onchange = handle(async () => {
    const result = await upload($('lane-input').files[0], 'lane');
    $('lane-input').value = '';
    if (result) toast('Lane-paketet kontrolleras. Välj den importerade kopian under Sparade lanes när jobbet är klart.');
  });
  return {render};
}
