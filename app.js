import { CAP, clone, solved, canPour, pour, generate, stars } from './engine.js?v=22';

const COLORS = ['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $ = selector => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d');

let state = [];
let initial = [];
let history = [];
let selected = null;
let level = 1;
let moves = 0;
let par = 20;
let busy = false;
let boxes = [];

const configForLevel = value => ({
  colors: Math.min(10, 3 + Math.floor((value - 1) / 8)),
  empties: value < 25 ? 2 : 3,
  difficulty: value < 12 ? 1 : value < 35 ? 2 : 3,
  seed: value * 7919 + 17
});

function save() {
  localStorage.setItem('sand-v22', JSON.stringify({ state, initial, history, level, moves, par }));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem('sand-v22'));
    if (!saved?.state?.length) return false;
    ({ state, initial, history, level, moves, par } = saved);
    selected = null;
    return true;
  } catch {
    return false;
  }
}

function updateUi() {
  $('#meta').textContent = `Level ${level} · ${moves} Züge`;
  const rating = stars(moves, par);
  $('#stars').textContent = '★'.repeat(rating) + '☆'.repeat(3 - rating);
  $('#undo').disabled = !history.length || busy;
  save();
}

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function layout() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const count = state.length;
  const columns = count <= 6 ? 3 : count <= 8 ? 4 : 5;
  const rows = Math.ceil(count / columns);
  const gapX = 10;
  const gapY = 24;
  const tubeWidth = Math.min(58, (width - 24 - (columns - 1) * gapX) / columns);
  const tubeHeight = Math.min(164, (height - 30 - (rows - 1) * gapY) / rows);
  const startX = (width - columns * tubeWidth - (columns - 1) * gapX) / 2;
  const startY = (height - rows * tubeHeight - (rows - 1) * gapY) / 2;
  boxes = state.map((_, index) => ({
    x: startX + (index % columns) * (tubeWidth + gapX),
    y: startY + Math.floor(index / columns) * (tubeHeight + gapY),
    w: tubeWidth,
    h: tubeHeight
  }));
}

function tubePath(box) {
  const radius = Math.min(16, box.w * 0.28);
  ctx.beginPath();
  ctx.moveTo(box.x + radius, box.y);
  ctx.arcTo(box.x + box.w, box.y, box.x + box.w, box.y + box.h, radius);
  ctx.arcTo(box.x + box.w, box.y + box.h, box.x, box.y + box.h, radius);
  ctx.arcTo(box.x, box.y + box.h, box.x, box.y, radius);
  ctx.arcTo(box.x, box.y, box.x + box.w, box.y, radius);
  ctx.closePath();
}

function drawTube(box, tube, isSelected = false, isValid = false) {
  const lifted = isSelected ? 12 : 0;
  const b = { ...box, y: box.y - lifted };
  ctx.save();
  if (isSelected) {
    ctx.shadowColor = '#8b65ff';
    ctx.shadowBlur = 18;
  }
  tubePath(b);
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  ctx.fill();

  ctx.save();
  tubePath({ x: b.x + 4, y: b.y + 5, w: b.w - 8, h: b.h - 9 });
  ctx.clip();
  const layerHeight = (b.h - 12) / CAP;
  tube.forEach((color, index) => {
    const y = b.y + b.h - 5 - (index + 1) * layerHeight;
    ctx.fillStyle = COLORS[color];
    ctx.fillRect(b.x + 4, y, b.w - 8, layerHeight + 1);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(b.x + 6, y + 2, 4, Math.max(1, layerHeight - 4));
  });
  ctx.restore();

  ctx.lineWidth = isSelected || isValid ? 4 : 3;
  ctx.strokeStyle = isSelected ? '#b694ff' : isValid ? '#42d6a5' : '#8295e7';
  tubePath(b);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(b.x + b.w / 2, b.y + 2, b.w / 2 + 1, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw(animation = null) {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  layout();
  state.forEach((tube, index) => {
    if (animation && index === animation.from) return;
    drawTube(boxes[index], tube, index === selected, selected !== null && canPour(state, selected, index));
  });
  if (animation) drawAnimation(animation);
}

function drawAnimation(animation) {
  const sourceBox = boxes[animation.from];
  const targetBox = boxes[animation.to];
  const direction = targetBox.x >= sourceBox.x ? 1 : -1;
  const z = animation.progress;
  let x = sourceBox.x;
  let y = sourceBox.y;
  let angle = 0;
  let poured = 0;

  if (z < 0.30) {
    const p = z / 0.30;
    const eased = 1 - Math.pow(1 - p, 3);
    x = sourceBox.x + (targetBox.x - sourceBox.x - direction * sourceBox.w * 0.35) * eased;
    y = sourceBox.y - 45 * Math.sin(Math.PI * eased) - 18 * eased;
  } else if (z < 0.45) {
    const p = (z - 0.30) / 0.15;
    x = targetBox.x - direction * sourceBox.w * 0.35;
    y = targetBox.y - 18;
    angle = direction * 68 * (1 - Math.pow(1 - p, 3));
  } else if (z < 0.80) {
    x = targetBox.x - direction * sourceBox.w * 0.35;
    y = targetBox.y - 18;
    angle = direction * 68;
    poured = (z - 0.45) / 0.35;
  } else {
    const p = (z - 0.80) / 0.20;
    const eased = p * p * (3 - 2 * p);
    x = (targetBox.x - direction * sourceBox.w * 0.35) * (1 - eased) + sourceBox.x * eased;
    y = (targetBox.y - 18) * (1 - eased) + sourceBox.y * eased;
    angle = direction * 68 * (1 - eased);
    poured = 1;
  }

  ctx.save();
  ctx.translate(x + sourceBox.w / 2, y + sourceBox.h * 0.08);
  ctx.rotate(angle * Math.PI / 180);
  ctx.translate(-sourceBox.w / 2, -sourceBox.h * 0.08);
  drawTube({ x: 0, y: 0, w: sourceBox.w, h: sourceBox.h }, animation.source);
  ctx.restore();

  if (z >= 0.45 && z < 0.80) {
    const startX = x + sourceBox.w / 2 + direction * sourceBox.w * 0.42;
    const startY = y + 18;
    const targetX = targetBox.x + targetBox.w / 2;
    const targetY = targetBox.y + 18;
    ctx.strokeStyle = COLORS[animation.color];
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, sourceBox.w * 0.12);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo((startX + targetX) / 2, startY + 8, targetX, targetY);
    ctx.stroke();

    const preview = clone(state);
    const count = Math.min(animation.amount, Math.floor(animation.amount * poured + 0.999));
    for (let i = 0; i < count; i++) {
      preview[animation.from].pop();
      preview[animation.to].push(animation.color);
    }
    drawTube(targetBox, preview[animation.to]);
  }
}

function startLevel(value = 1) {
  const puzzle = generate(configForLevel(value));
  state = clone(puzzle.state);
  initial = clone(state);
  history = [];
  selected = null;
  moves = 0;
  par = puzzle.par;
  level = value;
  updateUi();
  draw();
}

async function tapTube(index) {
  if (busy || index < 0) return;
  if (selected === null) {
    if (state[index].length) {
      selected = index;
      navigator.vibrate?.(10);
      draw();
    }
    return;
  }
  if (selected === index) {
    selected = null;
    draw();
    return;
  }
  if (!canPour(state, selected, index)) {
    selected = state[index].length ? index : null;
    navigator.vibrate?.([10, 25, 10]);
    draw();
    return;
  }

  busy = true;
  const from = selected;
  const result = pour(state, from, index);
  history.push(clone(state));
  selected = null;
  await new Promise(resolve => {
    const animation = { from, to: index, source: clone(state[from]), color: result.color, amount: result.amount, progress: 0 };
    const started = performance.now();
    const frame = now => {
      animation.progress = Math.min(1, (now - started) / 1050);
      draw(animation);
      animation.progress < 1 ? requestAnimationFrame(frame) : resolve();
    };
    requestAnimationFrame(frame);
  });
  state = result.state;
  moves++;
  busy = false;
  navigator.vibrate?.(18);
  updateUi();
  draw();
  if (solved(state)) setTimeout(showWin, 200);
}

function tubeAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return boxes.findIndex(box => x >= box.x - 8 && x <= box.x + box.w + 8 && y >= box.y - 20 && y <= box.y + box.h + 8);
}

canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  tapTube(tubeAt(event.clientX, event.clientY));
});
canvas.addEventListener('touchend', event => {
  event.preventDefault();
  const touch = event.changedTouches[0];
  if (touch) tapTube(tubeAt(touch.clientX, touch.clientY));
}, { passive: false });

$('#undo').onclick = () => {
  if (!history.length || busy) return;
  state = history.pop();
  moves = Math.max(0, moves - 1);
  selected = null;
  updateUi();
  draw();
};
$('#restart').onclick = () => {
  if (busy) return;
  state = clone(initial);
  history = [];
  moves = 0;
  selected = null;
  updateUi();
  draw();
};
$('#hint').onclick = () => {
  if (busy) return;
  for (let from = 0; from < state.length; from++) {
    for (let to = 0; to < state.length; to++) {
      if (canPour(state, from, to)) {
        selected = from;
        draw();
        return;
      }
    }
  }
};
$('#random').onclick = $('#settings').onclick = () => $('#settingsDialog').showModal();
$('#startRandom').onclick = () => {
  const puzzle = generate({ colors: +$('#colors').value, empties: 2, difficulty: +$('#difficulty').value, seed: Date.now() });
  state = clone(puzzle.state);
  initial = clone(state);
  history = [];
  selected = null;
  moves = 0;
  par = puzzle.par;
  $('#settingsDialog').close();
  updateUi();
  draw();
};
$('#colors').oninput = event => $('#colorsOut').textContent = event.target.value;
$('#difficulty').oninput = event => $('#difficultyOut').textContent = ['', 'Leicht', 'Mittel', 'Schwer'][event.target.value];
$('#levels').onclick = () => {
  const grid = $('#levelGrid');
  const progress = JSON.parse(localStorage.getItem('sand-progress-v22') || '{}');
  grid.innerHTML = '';
  for (let value = 1; value <= 60; value++) {
    const button = document.createElement('button');
    button.textContent = progress[value] ? `${value}\n${'★'.repeat(progress[value])}` : value;
    button.className = progress[value] ? 'done' : '';
    button.onclick = () => { startLevel(value); $('#levelDialog').close(); };
    grid.appendChild(button);
  }
  $('#levelDialog').showModal();
};
$('#next').onclick = () => { startLevel(Math.min(60, level + 1)); $('#winDialog').close(); };
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());

function showWin() {
  const rating = stars(moves, par);
  const progress = JSON.parse(localStorage.getItem('sand-progress-v22') || '{}');
  progress[level] = Math.max(progress[level] || 0, rating);
  localStorage.setItem('sand-progress-v22', JSON.stringify(progress));
  $('#winStars').textContent = '★'.repeat(rating) + '☆'.repeat(3 - rating);
  $('#winStats').textContent = `${moves} Züge · Par ${par}`;
  $('#winDialog').showModal();
}

new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister()));
load() ? updateUi() : startLevel(1);
resize();
