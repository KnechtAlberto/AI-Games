(() => {
  const canvas = document.getElementById('game');
  if (!canvas || !window.PointerEvent) return;
  canvas.addEventListener('touchend', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });
})();
