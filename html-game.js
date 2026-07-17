import { clone, generate, stars } from './engine.js?v=26';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=s=>document.querySelector(s),board=$('#board');
let state=[],initial=[],history=[],solution=[],capacities=[],roles=[],specials=[],outUses=[],inUses=[],selected=null,level=1,moves=0,par=20,busy=false;
let rules={hiddenTop:0,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
let lock={index:-1,trigger:-1,unlocked:true};

const complete=(tube,index)=>tube.length===capacities[index]&&tube.every(c=>c===tube[0]);
const solved=()=>state.every((tube,index)=>!tube.length||complete(tube,index));
const topRun=tube=>{if(!tube.length)return 0;let n=1;for(let i=tube.length-2;i>=0&&tube[i]===tube.at(-1);i--)n++;return n;};
const is