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

function particleStream(start, target, color, amount) {
  resizeCanvas();
  const particles = Array.from({ length: 70 + amount * 35 }, () => ({
    progress: -Math.random() * 0.2,
    speed: 0.032 + Math.random() * 0.012,
    offsetX: (Math.random() - 0.5) * 9,
    offsetY: (Math.random() - 0.5) * 7,
    radius: 0.9 + Math.random() * 1.5,
    alpha: 0.75 + Math.random() * 0.25
  }));
  let running = true;
  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = color;
    running = false;
    for (const particle of particles) {
      particle.progress += particle.speed;
      if (particle.progress < 0 || particle.progress > 1.05) continue;
      running = true;
      const t = Math.min(1, particle.progress);
      const x = start.x + (target.x - start.x) * t + particle.offsetX * (1 - t);
      const arc = Math.sin(Math.PI * t) * 18;
      const y = start.y + (target.y - start.y) * t - arc + particle.offsetY;
      ctx.globalAlpha = particle.alpha * (1 - Math.max(0, t - 0.82) / 0.18);
      ctx.beginPath();
      ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (running) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
  draw();
}

async function animatePour(fromIndex, toIndex, color, amount) {
  const fromElement = board.children[fromIndex];
  const toElement = board.children[toIndex];
  if (!fromElement || !toElement || !fromElement.animate) return;

  const fromRect = fromElement.getBoundingClientRect();
  const toRect = toElement.getBoundingClientRect();
  const direction = toRect.left >= fromRect.left ? 1 : -1;
  const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2) - direction * 22;
  const dy = toRect.top - fromRect.top - 42;
  const tilt = direction > 0 ? 68 : -68;
  const streamStart = {
    x: fromRect.left + fromRect.width / 2 + dx + direction * 23,
    y: fromRect.top + 10 + dy
  };
  const streamTarget = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + 22
  };

  fromElement.style.zIndex = '20';
  fromElement.style.transformOrigin = direction > 0 ? '80% 10%' : '20% 10%';
  const animation = fromElement.animate([
    { transform: 'translateY(-14px) rotate(0deg)', offset: 0 },
    { transform: `translate(${dx}px,${dy}px) rotate(${tilt}deg)`, offset: 0.32 },
    { transform: `translate(${dx}px,${dy}px) rotate(${tilt}deg)`, offset: 0.72 },
    { transform: 'translate(0,0) rotate(0deg)', offset: 1 }
  ], { duration: 760, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'both' });

  await new Promise(resolve => setTimeout(resolve, 245));
  particleStream(streamStart, streamTarget, color, amount);
  await animation.finished.catch(() => {});
  animation.cancel();
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
