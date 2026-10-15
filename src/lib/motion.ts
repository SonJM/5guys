export function motionAllowed(mobileOnly = true) {
  return typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    (!mobileOnly || window.matchMedia('(max-width: 1023px)').matches);
}

export function playMotion(element: HTMLElement, frames: Keyframe[], duration = 260, mobileOnly = true) {
  if (!motionAllowed(mobileOnly) || typeof element.animate !== 'function') return null;
  return element.animate(frames, { duration, easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'none' });
}
