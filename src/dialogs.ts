// An open dialog gets its own history entry, so the back gesture on phones and
// the browser's back button close the dialog instead of leaving the page.
// History changes run one at a time: a dialog's pending back step must never
// land after, and undo, the navigation or dialog that follows it.

const isDialogEntry = () => Boolean(history.state?.glowDialog);
let settling = Promise.resolve();
let ownBack = false;

export function pushDialogEntry() {
  settling = settling.then(() => {
    if (!isDialogEntry())
      history.pushState({ ...history.state, glowDialog: true }, "");
  });
}

export function popDialogEntry() {
  settling = settling.then(() => {
    if (!isDialogEntry()) return;
    return new Promise<void>((resolve) => {
      const done = () => {
        window.removeEventListener("popstate", done);
        clearTimeout(fallback);
        // Let every popstate listener see this was our own step back.
        setTimeout(() => {
          ownBack = false;
          resolve();
        });
      };
      const fallback = setTimeout(done, 1000);
      window.addEventListener("popstate", done);
      ownBack = true;
      history.back();
    });
  });
}

// Resolves once closing dialogs have left the history.
export const dialogsSettled = () => settling;

// Calls `close` when the person steps back out of a dialog's entry.
export function onDialogBack(close: () => void) {
  const listener = () => {
    if (!ownBack && !isDialogEntry()) close();
  };
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
