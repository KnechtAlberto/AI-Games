import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPour,
  generateSolvablePuzzle,
  isSolved,
  pour,
  replaySolution,
  starsForMoves
} from '../engine.js';

test('pouring obeys color and capacity rules', () => {
  const state = [[0, 0], [0], [1], []];
  assert.equal(canPour(state, 0, 1), true);
  assert.equal(canPour(state, 0, 2), false);
  const result = pour(state, 0, 1);
  assert.deepEqual(result.state, [[], [0, 0, 0], [1], []]);
  assert.equal(result.amount, 2);
});

test('all 60 campaign configurations produce replayable solutions', () => {
  for (let level = 1; level <= 60; level++) {
    const config = {
      colors: Math.min(10, 3 + Math.floor((level - 1) / 8)),
      emptyTubes: level < 25 ? 2 : 3,
      difficulty: level < 12 ? 1 : level < 35 ? 2 : 3,
      seed: level * 7919 + 17
    };
    const puzzle = generateSolvablePuzzle(config);
    assert.equal(isSolved(puzzle.state), false, `Level ${level} starts unsolved`);
    const finalState = replaySolution(puzzle.state, puzzle.solution);
    assert.ok(finalState, `Level ${level} solution only contains legal moves`);
    assert.equal(isSolved(finalState), true, `Level ${level} solution finishes the puzzle`);
  }
});

test('star thresholds are stable', () => {
  assert.equal(starsForMoves(10, 10), 3);
  assert.equal(starsForMoves(15, 10), 2);
  assert.equal(starsForMoves(16, 10), 1);
});
