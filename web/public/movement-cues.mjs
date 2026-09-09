// Emit only for frames that were presented. Skipped/hidden animation must not
// replay a burst of stale pickup sounds when it catches up.
export function movementCues(emit) {
  let started=false, landed=false;
  return (progress, audible=true) => {
    if (progress >= 1) {
      if (!landed && audible) emit('land');
      started=true; landed=true;
    } else if (!started) {
      started=true;
      if (audible && progress < .2) emit('pickup');
    }
  };
}
