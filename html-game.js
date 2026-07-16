import { CAP, clone, generate, stars } from './engine.js?v=26';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=selector=>document.querySelector(selector);
const board=$('#board');
let state=[],initial=[],history=[],solution=[],capacities=[],selected=null,level=1,moves=0,par=20,busy=false;
let rules={hiddenTop:0,bonusLock:false,smallTube