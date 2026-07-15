import { canPour, cloneState, generateSolvablePuzzle, isSolved, pour, starsForMoves } from './engine.js';

const TOTAL_LEVELS = 60;
const COLORS = ['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $ = s => document.querySelector(s);
const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d');
let tubes=[],initial=[],history=[],solution=[];
let selected=null,moves=0