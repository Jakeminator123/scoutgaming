function reset(media) {
  try { media.pause(); } catch { /* A detached or failed preview is already inert. */ }
  try { media.currentTime = 0; } catch { /* Metadata may not have loaded yet. */ }
}

function clear(media) {
  reset(media);
  try {
    media.removeAttribute('src');
    media.load();
  } catch { /* The page is closing or the element has already been removed. */ }
}

export function createSinglePreviewController() {
  let active = null;
  const bound = new WeakSet();
  return {
    bind(root) {
      for (const media of root?.querySelectorAll?.('[data-bo-preview]') ?? []) {
        if (bound.has(media)) continue;
        bound.add(media);
        media.addEventListener('play', () => {
          if (active && active !== media) reset(active);
          active = media;
        });
        media.addEventListener('ended', () => { if (active === media) active = null; });
      }
    },
    release(root) {
      const media = new Set(root?.querySelectorAll?.('[data-bo-preview]') ?? []);
      if (active) media.add(active);
      for (const item of media) clear(item);
      active = null;
    },
  };
}
