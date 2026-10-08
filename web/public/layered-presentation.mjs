const DEAL_CARD = { r: 'A', s: 'S' };

function createStatus(host) {
  const status = document.createElement('div');
  status.className = 'local-presentation-status';
  status.setAttribute('role', 'status');
  host.append(status);
  return status;
}

function laneUnavailable(error) {
  const message = String(error?.message || '');
  return message.includes('layer_pack_unavailable') || message.includes('layer_pack_missing') || message.includes('layer_pack_denied');
}

async function loadManifest(dealerId) {
  const response = await fetch(`/layer-packs/${encodeURIComponent(dealerId)}/manifest.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? 'layer_pack_unavailable' : 'layer_pack_missing');
  const manifest = await response.json();
  if (!manifest || typeof manifest !== 'object' || !manifest.scene || !manifest.dealer || !Array.isArray(manifest.assets)) {
    throw new Error('layer_pack_invalid');
  }
  return manifest;
}

function firstDealClip(manifest) {
  for (const clip of Object.values(manifest.dealer?.clips || {})) {
    if (clip?.role === 'deal' && typeof clip.target === 'string') return clip;
  }
  return null;
}

function mountRehearsal({ host, player, manifest, status }) {
  const clips = Object.values(manifest.dealer?.clips || {}).filter(clip => clip?.role === 'deal' && typeof clip.target === 'string');
  if (!clips.length) return;
  const panel = document.createElement('details');
  panel.id = 'layered-rehearsal';
  const summary = document.createElement('summary');
  summary.textContent = 'Layer rehearsal';
  const row = document.createElement('div');
  row.className = 'choice-row';
  const select = document.createElement('select');
  for (const clip of clips) {
    const option = document.createElement('option');
    option.value = clip.id;
    option.textContent = clip.id;
    row.append(option);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Play twice';
  button.onclick = () => {
    const clip = clips.find(item => item.id === select.value);
    if (!clip) return;
    const faceDown = clip.target === 'hole';
    player.stop();
    player.enqueueDeal(clip.target, faceDown ? { r: null, s: null, faceDown: true, shoeDraw: 1 } : { ...DEAL_CARD, shoeDraw: 1 }, true);
    player.enqueueDeal(clip.target, faceDown ? { r: null, s: null, faceDown: true, shoeDraw: 2 } : { ...DEAL_CARD, shoeDraw: 2 }, true);
    status.textContent = `Rehearsal: ${clip.id} x2`;
  };
  row.append(select, button);
  panel.append(summary, row);
  host.append(panel);
}

export async function createLayeredPresentationWithRuntime({
  host,
  dealerId,
  receipt = () => {},
  onBusy = () => {},
  rehearsal = false,
  loadRuntime = () => {
    const runtimeBase = `/${['layer-packs', 'runtime'].join('/')}/`;
    const dynamicImport = path => Function('modulePath', 'return import(modulePath);')(path);
    return Promise.all([
      dynamicImport(`${runtimeBase}player.js`),
      dynamicImport(`${runtimeBase}bridge.js`),
    ]);
  },
  readManifest = loadManifest,
} = {}) {
  if (!host || typeof dealerId !== 'string') throw new Error('layer_pack_invalid');
  const status = createStatus(host);
  const canvas = document.createElement('canvas');
  canvas.className = 'layered-presentation-canvas';
  host.prepend(canvas);

  let closed = false;
  let player = null;
  let bridge = null;
  let manifest = null;
  let selectedBackground = null;
  let selectedDealer = dealerId;

  function onUnsupported(issue) {
    status.textContent = `Lämnas till värdspelet: ${issue.type}`;
    receipt({ event: 'layered-unsupported', state: 'ignored', type: issue.type, message: issue.message });
  }

  try {
    const [{ StudioPlayer }, { attachScoutGamingBridge }] = await loadRuntime();
    manifest = await readManifest(selectedDealer);
    selectedBackground = manifest.scene?.background || null;
    player = new StudioPlayer(canvas, {
      mediaURL: path => new URL(path, '/layer-packs/').href,
      onError: message => { if (!closed) status.textContent = message; },
    });
    await player.setScene(manifest.scene);
    await player.setDealer(manifest.dealer, manifest.variant || manifest.dealer.active_variant);
    await player.setAssets(manifest.assets);
    bridge = attachScoutGamingBridge(player, {
      boxBase: 0,
      onReceipt: event => receipt({ event: event.type, state: 'presented', ...event }),
      onUnsupported,
    });
    player.addEventListener('queue-idle', () => { if (!closed) status.textContent = 'queue-idle'; });
    player.addEventListener('card-landed', () => { if (!closed) status.textContent = 'card-landed'; });
    if (rehearsal) mountRehearsal({ host, player, manifest, status });
    status.textContent = '';
  } catch (error) {
    status.textContent = laneUnavailable(error) ? 'Lagerpaket saknas' : 'Lagerpresentation kunde inte startas';
    throw error;
  }

  return {
    present() { return Promise.resolve(true); },
    state() {},
    observeChat() {},
    prepareSequence() {},
    start() {},
    get idleBackground() { return false; },
    consume({ roundId, presentation }) {
      onBusy();
      if (!bridge || !Array.isArray(presentation)) return { accepted: 0, duplicates: 0, unsupported: [] };
      const result = bridge.consume({ roundId, presentation });
      if (result.unsupported.length === 0) status.textContent = '';
      return result;
    },
    async setBackground(id) {
      if (!player || !manifest || typeof id !== 'string' || !id || id === selectedBackground) return false;
      const asset = manifest.assets.find(item => item.role === 'background' && item.id === id);
      if (!asset) return false;
      selectedBackground = id;
      manifest.scene = { ...manifest.scene, background: id };
      await player.setScene(manifest.scene);
      await player.setAssets(manifest.assets);
      return true;
    },
    close() {
      closed = true;
      bridge?.detach?.();
      player?.destroy?.();
      status.remove();
      canvas.remove();
    },
  };
}

export async function createLayeredPresentation(options = {}) {
  return createLayeredPresentationWithRuntime(options);
}

export function layeredUnavailableText(error) {
  return laneUnavailable(error) ? 'Lagerpaket saknas' : 'Lagerpresentation kunde inte startas';
}
