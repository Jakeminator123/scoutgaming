// Keep document/session navigation separate from retained in-page editor state.
export function createPartnerLeaveGuard({isDirty, confirmLeave}) {
  let approved = false;
  return {
    requestLeave() {
      if (!isDirty()) return true;
      if (!confirmLeave()) return false;
      approved = true;
      return true;
    },
    reset() { approved = false; },
    beforeUnload(event) {
      if (isDirty() && !approved) { event.preventDefault(); event.returnValue = ''; }
    },
  };
}
