// Is this a touch-only device (no mouse to hover with)? Keyboard hints and hover-only affordances stay off it.
export function touchOnly(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
}

/** A phone-width screen (the tab bar layout), for text that has to fit on one line. */
export function narrowScreen(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
}
