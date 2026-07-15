import { canPour, cloneState, generateSolvablePuzzle, isSolved, pour, starsForMoves } from './engine.js';

const TOTAL_LEVELS = 60;
const COLORS = ['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $ = selector => document.querySelector(selector);
const board = $('#board');
const canvas = $('#particles');
const ctx = canvas.getContext('2d');

let tubes = [], initial = [], history = [], solution = [];
let selected = null, moves = 0, startedAt = 0, currentLevel = 1, par = 1;
let mode = 'campaign', busy = false, deferredPrompt = null;

const levelConfig = level => ({
  colors: Math.min(10, 3 + Math.floor((level - 1) / 8)),
  emptyTubes: level < 25 ? 2 : 3,
  difficulty: level < 12 ? 1 : level < 35 ? 2 : 3,
  seed: level * 7919 + 17
});

function progress() { try { return JSON.parse(localStorage.getItem('sand-progress') || '{}'); } catch { return {}; } }
function saveProgress(value) { localStorage.setItem('sand-progress', JSON.stringify(value)); }
function saveGame() { localStorage.setItem('sand-save-v2', JSON.stringify({ tubes, initial, history, solution, moves, startedAt, currentLevel, mode, par })); }
function loadGame() {
  try {
    const value = JSON.parse(localStorage.getItem('sand-save-v2'));
    if (!value?.tubes?.length) return false;
    ({ tubes, initial, history, solution, moves, startedAt, currentLevel, mode, par } = value);
    selected = null;
    return true;
  } catch { return false; }
}

const currentStars = () => starsForMoves(moves, par);
const starText = (count = currentStars()) => '★'.repeat(count) + '☆'.repeat(3 - count);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function resizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render() {
  board.innerHTML = '';
  tubes.forEach((tube, index) => {
    const element = document.createElement('button');
    element.className = 'tube';
    if (selected === index) element.classList.add('selected');
    if (selected !== null && canPour(tubes, selected, index)) element.classList.add('valid');
    element.setAttribute('aria-label', `Glas ${index + 1}`);
    tube.forEach((color, layerIndex) => {
      const layer = document.createElement('span');
      layer.className = 'sand';
      layer.style.setProperty('--i', layerIndex);
      layer.style.setProperty('--c', COLORS[color]);
      element.appendChild(layer);
    });
    element.onclick = () => tapTube(index);
    board.appendChild(element);
  });
  $('#status').textContent = `${moves} Züge · Par ${par}`;
  $('#stars').textContent = starText();
  $('#levelText').textContent = mode === 'campaign' ? `Level ${currentLevel}` : 'Zufallsspiel';
  $('#undo').disabled = history.length === 0 || busy;
  saveGame();
}

function drawSandStream(start, target, color, duration) {
  resizeCanvas();
  const started = performance.now();
  let raf = 0;

  function frame(now) {
    const elapsed = now - started;
    const fadeIn = Math.min(1, elapsed / 90);
    const fadeOut = Math.min(1, Math.max(0, duration - elapsed) / 120);
    const alpha = fadeIn * fadeOut;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    const controlX = start.x + (target.x - start.x) * 0.34;
    const controlY = Math.min(start.y, target.y) - 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.globalAlpha = alpha * 0.32;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);
    ctx.stroke();

    for (let i = 0; i < 15; i++) {
      const t = ((elapsed * 0.0014) + i / 15) % 1;
      const mt = 1 - t;
      const x = mt * mt * start.x + 2 * mt * t * controlX + t * t * target.x;
      const y = mt * mt * start.y + 2 * mt * t * controlY + t * t * target.y;
      ctx.globalAlpha = alpha * (0.5 + (i % 3) * 0.18);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + Math.sin(i * 3.1) * 1.3, y, 1.1 + (i % 2) * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (elapsed < duration) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
}

function animateLevels(fromElement, toElement, amount, color, duration) {
  const sourceLayers = [...fromElement.querySelectorAll('.sand')].slice(-amount);
  sourceLayers.forEach((layer, index) => {
    layer.animate([
      { transform: 'scaleY(1)', opacity: 1 },
      { transform: 'scaleY(1)', opacity: 1, offset: index / Math.max(1, amount) * 0.25 },
      { transform: 'scaleY(0)', opacity: 0.18 }
    ], { duration, easing: 'linear', fill: 'forwards' });
  });

  const ghost = document.createElement('span');
  ghost.className = 'sand transfer-fill';
  ghost.style.setProperty('--c', color);
  ghost.style.bottom = `${tubes[toElement.dataset.index]?.length * 25}%`;
  ghost.style.height = `${amount * 25}%`;
  ghost.style.transform = 'scaleY(0)';
  ghost.style.transformOrigin = 'bottom';
  toElement.appendChild(ghost);
  ghost.animate([
    { transform: 'scaleY(0)' },
    { transform: 'scaleY(1)' }
  ], { duration, easing: 'linear', fill: 'forwards' });
  return ghost;
}

async function animatePour(fromIndex, toIndex, color, amount) {
  const fromElement = board.children[fromIndex];
  const toElement = board.children[toIndex];
  if (!fromElement || !toElement || !fromElement.animate) return;
  fromElement.dataset.index = fromIndex;
  toElement.dataset.index = toIndex;

  const fromRect = fromElement.getBoundingClientRect();
  const toRect = toElement.getBoundingClientRect();
  const direction = toRect.left >= fromRect.left ? 1 : -1;
  const centerFromX = fromRect.left + fromRect.width / 2;
  const centerToX = toRect.left + toRect.width / 2;
  const dx = centerToX - centerFromX - direction * 15;
  const lift = Math.min(82, Math.max(50, Math.abs(dx) * 0.16 + 48));
  const tilt = direction > 0 ? 78 : -78;

  fromElement.style.zIndex = '30';
  fromElement.style.transformOrigin = direction > 0 ? '78% 12%' : '22% 12%';

  const travel = fromElement.animate([
    { transform: 'translate(0, -14px) rotate(0deg)', offset: 0 },
    { transform: `translate(${dx * 0.48}px, ${-lift}px) rotate(${tilt * 0.18}deg)`, offset: 0.34 },
    { transform: `translate(${dx}px, ${-lift + 4}px) rotate(${tilt}deg)`, offset: 0.56 },
    { transform: `translate(${dx}px, ${-lift + 4}px) rotate(${tilt}deg)`, offset: 0.82 },
    { transform: `translate(${dx * 0.45}px, ${-lift * 0.55}px) rotate(${tilt * 0.12}deg)`, offset: 0.93 },
    { transform: 'translate(0, 0) rotate(0deg)', offset: 1 }
  ], { duration: 1160, easing: 'cubic-bezier(.22,.74,.22,1)', fill: 'both' });

  await wait(650);
  const movedRect = fromElement.getBoundingClientRect();
  const mouth = {
    x: direction > 0 ? movedRect.right - 7 : movedRect.left + 7,
    y: movedRect.top + movedRect.height * 0.24
  };
  const target = {
    x: centerToX,
    y: toRect.top + 15
  };
  const pourDuration = 315 + amount * 95;
  const stopStream = drawSandStream(mouth, target, color, pourDuration);
  const ghost = animateLevels(fromElement, toElement, amount, color, pourDuration);
  await wait(pourDuration);
  stopStream();
  await travel.finished.catch(() => {});
  travel.cancel();
  ghost.remove();
  fromElement.style.zIndex = '';
  fromElement.style.transformOrigin = '';
}

async function tapTube(index) {
  if (busy) return;
  if (selected === null) {
    if (tubes[index].length) { selected = index; navigator.vibrate?.(10); render(); }
    return;
  }
  if (selected === index) { selected = null; render(); return; }
  if (!canPour(tubes, selected, index)) {
    selected = tubes[index].length ? index : null;
    navigator.vibrate?.([10,25,10]);
    render();
    return;
  }

  busy = true;
  const from = selected;
  const result = pour(tubes, from, index);
  const color = COLORS[tubes[from][tubes[from].length - 1]];
  history.push(cloneState(tubes));
  selected = null;
  await animatePour(from, index, color, result.amount);
  tubes = result.state;
  moves++;
  busy = false;
  navigator.vibrate?.(18);
  render();
  if (isSolved(tubes)) setTimeout(showWin, 260);
}

function startPuzzle(puzzle, nextMode, level = currentLevel) {
  tubes = cloneState(puzzle.state); initial = cloneState(puzzle.state);
  solution = puzzle.solution.map(move => ({ ...move }));
  history = []; selected = null; moves = 0; startedAt = Date.now();
  currentLevel = level; mode = nextMode; par = puzzle.par;
  showGame(); closeDialogs(); render();
}
function startLevel(level) { startPuzzle(generateSolvablePuzzle(levelConfig(level)), 'campaign', level); }
function startRandom() {
  startPuzzle(generateSolvablePuzzle({ colors: Number($('#colors').value), emptyTubes: 2, difficulty: Number($('#difficulty').value), seed: Date.now() }), 'random');
}
function undo() { if (!history.length || busy) return; tubes = history.pop(); selected = null; moves = Math.max(0, moves - 1); render(); }
function restart() { if (busy) return; tubes = cloneState(initial); history = []; selected = null; moves = 0; startedAt = Date.now(); render(); }
function hint() {
  if (busy) return;
  const candidates = [...solution];
  for (let from = 0; from < tubes.length; from++) for (let to = 0; to < tubes.length; to++) candidates.push({ from, to });
  const move = candidates.find(candidate => canPour(tubes, candidate.from, candidate.to));
  if (!move) return;
  selected = move.from; render();
  board.children[move.to]?.animate([{ transform:'scale(1)' },{ transform:'scale(1.12)' },{ transform:'scale(1)' }],{ duration:650 });
}
function showWin() {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const stars = currentStars();
  if (mode === 'campaign') { const value = progress(); value[currentLevel] = Math.max(value[currentLevel] || 0, stars); saveProgress(value); }
  $('#winStars').textContent = starText(stars);
  $('#winStats').textContent = `${moves} Züge · Par ${par} · ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')} Min`;
  $('#nextLevel').hidden = mode !== 'campaign';
  $('#winDialog').showModal();
  navigator.vibrate?.([25,35,25]);
}
function buildLevels() {
  const value = progress(), grid = $('#levelGrid'); grid.innerHTML = '';
  for (let level = 1; level <= TOTAL_LEVELS; level++) {
    const button = document.createElement('button');
    button.innerHTML = value[level] ? `${level}<small>${'★'.repeat(value[level])}</small>` : String(level);
    if (value[level]) button.classList.add('done');
    button.onclick = () => startLevel(level);
    grid.appendChild(button);
  }
}
function showGame() { $('#home').classList.add('hidden'); $('#game').classList.remove('hidden'); }
function showHome() { $('#game').classList.add('hidden'); $('#home').classList.remove('hidden'); }
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
function showInstallHelp() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('#installText').textContent = standalone ? 'Die App ist bereits installiert.' : 'In Safari unten auf Teilen tippen und anschließend „Zum Home-Bildschirm“ wählen.';
  $('#installDialog').showModal();
}

$('#openSand').onclick = () => loadGame() ? (showGame(), render()) : startLevel(1);
$('#backHome').onclick = showHome;
$('#undo').onclick = undo;
$('#hint').onclick = hint;
$('#restart').onclick = restart;
$('#levels').onclick = () => { buildLevels(); $('#levelDialog').showModal(); };
$('#settings').onclick = () => $('#settingsDialog').showModal();
$('#randomGame').onclick = startRandom;
$('#nextLevel').onclick = () => startLevel(Math.min(TOTAL_LEVELS, currentLevel + 1));
$('#installSettings').onclick = showInstallHelp;
$('#installBtn').onclick = async () => {
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true; }
  else showInstallHelp();
};
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
$('#colors').oninput = event => $('#colorsOut').textContent = event.target.value;
$('#difficulty').oninput = event => $('#difficultyOut').textContent = ['', 'Leicht', 'Mittel', 'Schwer'][event.target.value];
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; $('#installBtn').hidden = false; });
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');