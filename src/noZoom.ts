// iOS Safari (including installed PWAs) ignores `user-scalable=no`, so block
// pinch-zoom here. Double-tap zoom is handled by `touch-action: manipulation`
// in app.css, which — unlike preventing touchend — keeps rapid taps working.
const block = (e: Event) => e.preventDefault();

document.addEventListener("gesturestart", block, { passive: false });
document.addEventListener("gesturechange", block, { passive: false });
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
