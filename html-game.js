import { CAP, clone, solved, canPour, pour, generate, stars } from './engine.js?v=23';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=s=>document.querySelector(s);
const board=$('#board');
let state=[],initial=[],history=[],selected=null,level=1,moves=0,par=20,busy=false;

function config(value){return{colors:Math.min(10,3+Math.floor((value-1)/8)),empties:value<25?2:3,difficulty:value<12?1:value<35?2:3,seed:value*7919+17};}
function save(){localStorage.setItem('sand-html-v23',JSON.stringify({state,initial,history,level,moves,par}));}
function load(){try{const v=JSON.parse(localStorage.getItem('sand-html-v23'));if(!v?.state?.length)return false;({state,initial,history,level,moves,par}=v);selected=null;return true;}catch{return false;}}
function updateUi(){
  $('#meta').textContent=`Level ${level} · ${moves} Züge`;
  const r=stars(moves,par);$('#stars').textContent='★'.repeat(r)+'☆'.repeat(3-r);
  $('#undo').disabled=!history.length||busy;save();
}
function render(){
  board.innerHTML='';
  state.forEach((tube,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='tubeButton';button.dataset.index=index;
    if(index===selected)button.classList.add('selected');
    if(selected!==null&&canPour(state,selected,index))button.classList.add('valid');
    button.setAttribute('aria-label',`Glas ${index+1}`);
    tube.forEach((color,i)=>{const layer=document.createElement('span');layer.className='sandLayer';layer.style.setProperty('--i',i);layer.style.setProperty('--c',COLORS[color]);button.appendChild(layer);});
    button.addEventListener('click',()=>tap(index),{passive:true});
    board.appendChild(button);
  });
  updateUi();
}
async function tap(index){
  if(busy)return;
  if(selected===null){if(state[index].length){selected=index;navigator.vibrate?.(10);render();}return;}
  if(selected===index){selected=null;render();return;}
  if(!canPour(state,selected,index)){selected=state[index].length?index:null;render();return;}
  busy=true;const from=selected;const result=pour(state,from,index);history.push(clone(state));selected=null;
  const source=board.children[from],target=board.children[index];
  if(source&&target&&source.animate){const a=target.getBoundingClientRect(),b=source.getBoundingClientRect();const dx=a.left-b.left,dy=a.top-b.top-20,dir=dx>=0?1:-1;const anim=source.animate([{transform:'translateY(-10px)'},{transform:`translate(${dx-dir*18}px,${dy}px) rotate(${dir*62}deg)`,offset:.42},{transform:`translate(${dx-dir*18}px,${dy}px) rotate(${dir*62}deg)`,offset:.72},{transform:'translate(0) rotate(0)'}],{duration:720,easing:'cubic-bezier(.2,.75,.2,1)'});await anim.finished.catch(()=>{});}
  state=result.state;moves++;busy=false;navigator.vibrate?.(18);render();if(solved(state))setTimeout(showWin,150);
}
function startLevel(value=1){const p=generate(config(value));state=clone(p.state);initial=clone(state);history=[];selected=null;moves=0;par=p.par;level=value;render();}
function showWin(){const r=stars(moves,par),p=JSON.parse(localStorage.getItem('sand-progress-v23')||'{}');p[level]=Math.max(p[level]||0,r);localStorage.setItem('sand-progress-v23',JSON.stringify(p));$('#winStars').textContent='★'.repeat(r)+'☆'.repeat(3-r);$('#winStats').textContent=`${moves} Züge · Par ${par}`;$('#winDialog').showModal();}

$('#undo').onclick=()=>{if(!history.length||busy)return;state=history.pop();moves=Math.max(0,moves-1);selected=null;render();};
$('#restart').onclick=()=>{if(busy)return;state=clone(initial);history=[];selected=null;moves=0;render();};
$('#hint').onclick=()=>{if(busy)return;for(let a=0;a<state.length;a++)for(let b=0;b<state.length;b++)if(canPour(state,a,b)){selected=a;render();return;}};
$('#random').onclick=$('#settings').onclick=()=>$('#settingsDialog').showModal();
$('#startRandom').onclick=()=>{const p=generate({colors:+$('#colors').value,empties:2,difficulty:+$('#difficulty').value,seed:Date.now()});state=clone(p.state);initial=clone(state);history=[];selected=null;moves=0;par=p.par;$('#settingsDialog').close();render();};
$('#colors').oninput=e=>$('#colorsOut').textContent=e.target.value;
$('#difficulty').oninput=e=>$('#difficultyOut').textContent=['','Leicht','Mittel','Schwer'][e.target.value];
$('#levels').onclick=()=>{const grid=$('#levelGrid'),progress=JSON.parse(localStorage.getItem('sand-progress-v23')||'{}');grid.innerHTML='';for(let i=1;i<=60;i++){const b=document.createElement('button');b.textContent=progress[i]?`${i}\n${'★'.repeat(progress[i])}`:i;b.className=progress[i]?'done':'';b.onclick=()=>{startLevel(i);$('#levelDialog').close();};grid.appendChild(b);}$('#levelDialog').showModal();};
$('#next').onclick=()=>{startLevel(Math.min(60,level+1));$('#winDialog').close();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
load()?render():startLevel(1);
