// Svelte action: trap Tab focus inside a dialog, focus the first control on open, restore focus on close.
const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusTrap(node: HTMLElement) {
  const previous = document.activeElement as HTMLElement | null;
  const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => el.offsetParent !== null || el === document.activeElement);

  const raf = requestAnimationFrame(() => {
    if (!node.contains(document.activeElement)) {
      const first = focusables()[0] ?? node;
      first.focus({ preventScroll: true });
    }
  });

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const els = focusables();
    if (!els.length) {
      e.preventDefault();
      return;
    }
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !node.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !node.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
  node.addEventListener('keydown', onKey);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    },
  };
}
