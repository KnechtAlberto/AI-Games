export const CAPACITY = 4;

export function cloneState(state) {
  return state.map(tube => [...tube]);
}

export function topRun(tube) {
  if (!tube.length) return 0;
  const color = tube[tube.length - 1];
  let count = 1;
  for (let i = tube.length - 2; i >= 0 && tube[i] === color; i--) count++;
  return count;
}

export function isTubeComplete(tube, capacity = CAPACITY) {
  return tube.length === capacity && tube.every(color => color === tube[0]);
}

export function isSolved(state, capacity = CAPACITY) {
  return state.every(tube => tube.length === 0 || isTubeComplete(tube, capacity));
}

export function canPour(state, from, to, capacity = CAPACITY) {
  if (from === to || !state[from]?.length || !state[to] || state[to].length >= capacity) return false;
  return state[to].length === 0 || state[to][state[to].length - 1] === state[from][state[from].length - 1];
}

export function pour(state, from, to, capacity = CAPACITY) {
  if (!canPour(state, from, to, capacity)) return null;
  const next = cloneState(state);
  const amount = Math.min(topRun(next[from]), capacity - next[to].length);
  for (let i = 0; i < amount; i++) next[to].push(next[from].pop());
  return { state: next, amount };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generateSolvablePuzzle({ colors, emptyTubes = 2, difficulty = 2, seed = Date.now() }) {
  const random = seededRandom(seed);
  const state = Array.from({ length: colors }, (_, color) => Array(CAPACITY).fill(color));
  for (let i = 0; i < emptyTubes; i++) state.push([]);

  const reverseSolution = [];
  const targetMoves = colors * [0, 8, 15, 24][difficulty];
  let previous = null;

  for (let step = 0; step < targetMoves; step++) {
    const candidates = [];
    for (let from = 0; from < state.length; from++) {
      if (!state[from].length) continue;
      const run = topRun(state[from]);
      for (let to = 0; to < state.length; to++) {
        if (from === to || state[to].length >= CAPACITY) continue;
        const movingColor = state[from][state[from].length - 1];
        if (state[to].length && state[to][state[to].length - 1] === movingColor) continue;
        const maxAmount = Math.min(run, CAPACITY - state[to].length);
        for (let amount = 1; amount <= maxAmount; amount++) {
          if (amount === run && amount < state[from].length) continue;
          if (previous && previous.from === to && previous.to === from && previous.amount === amount) continue;
          const sourceWillRemain = state[from].length - amount;
          if (sourceWillRemain === 0 && state[to].length === 0) continue;
          candidates.push({ from, to, amount });
        }
      }
    }
    if (!candidates.length) break;
    const move = candidates[Math.floor(random() * candidates.length)];
    for (let i = 0; i < move.amount; i++) state[move.to].push(state[move.from].pop());
    reverseSolution.unshift({ from: move.to, to: move.from });
    previous = move;
  }

  const order = shuffle([...state.keys()], random);
  const remap = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const shuffledState = order.map(index => state[index]);
  const solution = reverseSolution.map(move => ({ from: remap.get(move.from), to: remap.get(move.to) }));

  const verified = replaySolution(shuffledState, solution);
  if (isSolved(shuffledState) || !verified || !isSolved(verified)) {
    return generateSolvablePuzzle({ colors, emptyTubes, difficulty, seed: seed + 1 });
  }

  return { state: shuffledState, solution, par: Math.max(colors * 2, solution.length) };
}

export function starsForMoves(moves, par) {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

export function replaySolution(initialState, solution) {
  let state = cloneState(initialState);
  for (const move of solution) {
    const result = pour(state, move.from, move.to);
    if (!result) return null;
    state = result.state;
  }
  return state;
}
