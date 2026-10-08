/** Show the chat line when its matching dealer clip actually starts. */
export function enqueueSynchronizedReply(enqueue, item, reveal) {
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    reveal();
  };

  try {
    return Promise.resolve(enqueue({ ...item, onStart: show })).then(
      (played) => {
        if (!played) show();
        return played;
      },
      () => {
        show();
        return false;
      },
    );
  } catch {
    show();
    return Promise.resolve(false);
  }
}
