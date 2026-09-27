// use:visible={callback}: calls back when the element scrolls into view (for rendering long lists a page at a time).
import type { Action } from 'svelte/action';

export const visible: Action<HTMLElement, () => void> = (node, cb) => {
  let fn = cb;
  if (typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && fn(), { rootMargin: '600px 0px' });
  io.observe(node);
  return {
    update(next) {
      fn = next;
    },
    destroy() {
      io.disconnect();
    },
  };
};

/** Rows rendered per page in long lists. */
export const LIST_PAGE = 150;
