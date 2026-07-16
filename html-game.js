import { CAP, clone, solved, canPour, pour, generate, stars } from './engine.js?v=25';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=selector=>document.querySelector(selector);
const board=$('#board');
let state=[],initial=[],history=[],solution=[],selected=null,level=1,moves=0,par=20,busy=false;
let rules={hiddenTop:0,bonusLock:false};
let lock={index:-1,trigger:-1,unlocked:true};

function levelRules(value){
  if(value<=6)return{hiddenTop:0,bonusLock:false};
  if(value<=12)return{hiddenTop:2,bonusLock:false};
  if(value<=18)return{hiddenTop:0,bonusLock:true};
  if(value<=30)return{hiddenTop:2,bonusLock:true};
  return{hiddenTop:1,bonusLock:true};
}

function config(value){
  return{
    colors:Math.min(10,3+Math.floor((value-1)/8)),
    empties:2,
    difficulty:value<10?1:value<25?2:3,
    seed:value*7919+17
  };
}

function complete(tube){return tube.length===CAP&&tube.every(color=>color===tube[0]);}
function isLocked(index){return rules.bonusLock&&index===lock.index&&!lock.unlocked;}
function snapshot(){return{state:clone(state),unlocked:lock.unlocked};}
function restore(value){state=clone(value.state);lock.unlocked=value.unlocked;}

function setupPuzzle(puzzle,nextRules,value=level){
  state=clone(puzzle.state);
  solution=(puzzle.solution||[]).map(move=>({...move}));
  rules={...nextRules};
  lock={index:-1,trigger:-1,unlocked:true};
  if(rules.bonusLock){
    lock.index=state.length;
    state.push([]);
    lock.trigger=state.findIndex((tube,index)=>index!==lock.index&&tube.length>0&&!complete(tube));
    if(lock.trigger<0)lock.trigger=0;
    lock.unlocked=complete(state[lock.trigger]);
  }
  initial=clone(state);
  history=[];
  selected=null;
  moves=0;
  par=puzzle.par;
  level=value;
  render();
}

function save(){
  localStorage.setItem('sand-logic-v25',JSON.stringify({state,initial,history,solution,level,moves,par,rules,lock}));
}

function load(){
  try{
    const value=JSON.parse(localStorage.getItem('sand-logic-v25'));
    if(!value?.state?.length)return false;
    ({state,initial,history,solution,level,moves,par,rules,lock}=value);
    selected=null;
    return true;
  }catch{return false;}
}

function ruleText(){
  const items=[];
  if(rules.hiddenTop)items.push(`◉ Nur die obersten ${rules.hiddenTop===1?'Schicht ist':'Schichten sind'} sichtbar`);
  if(rules.bonusLock){
    items.push(lock.unlocked?'🔓 Bonusglas freigeschaltet':`🔒 Bonusglas öffnet sich, wenn Glas ${lock.trigger+1} sortiert ist`);
  }
  $('#rules').innerHTML=items.length?items.map(item=>`<span>${item}</span>`).join(''):'<span class="plain">Klassisches Sortieren</span>';
}

function updateUi(){
  $('#meta').textContent=`Level ${level} · ${moves} Züge`;
  const rating=stars(moves,par);
  $('#stars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);
  $('#undo').disabled=!history.length||busy;
  ruleText();
  save();
}

function layerIsHidden(tube,index){
  if(!rules.hiddenTop)return false;
  return index<tube.length-rules.hiddenTop;
}

function render(){
  board.innerHTML='';
  state.forEach((tube,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='tubeButton';
    if(index===selected)button.classList.add('selected');
    if(selected!==null&&!isLocked(index)&&!isLocked(selected)&&canPour(state,selected,index))button.classList.add('valid');
    if(isLocked(index))button.classList.add('locked');
    if(index===lock.trigger&&!lock.unlocked)button.classList.add('trigger');
    button.setAttribute('aria-label',isLocked(index)?`Glas ${index+1}, gesperrt`:`Glas ${index+1}`);

    tube.forEach((color,layerIndex)=>{
      const layer=document.createElement('span');
      layer.className='sandLayer';
      layer.style.setProperty('--i',layerIndex);
      if(layerIsHidden(tube,layerIndex)){
        layer.classList.add('hiddenLayer');
        layer.textContent='?';
      }else{
        layer.style.setProperty('--c',COLORS[color]);
      }
      button.appendChild(layer);
    });

    if(isLocked(index)){
      const badge=document.createElement('span');
      badge.className='lockBadge';
      badge.textContent='🔒';
      button.appendChild(badge);
    }
    if(index===lock.trigger&&!lock.unlocked){
      const badge=document.createElement('span');
      badge.className='goalBadge';
      badge.textContent='1';
      button.appendChild(badge);
    }
    button.addEventListener('click',()=>tap(index));
    board.appendChild(button);
  });
  updateUi();
}

function updateUnlock(){
  if(rules.bonusLock&&!lock.unlocked&&complete(state[lock.trigger])){
    lock.unlocked=true;
    navigator.vibrate?.([20,30,20]);
  }
}

function tap(index){
  if(busy)return;
  if(isLocked(index)){
    navigator.vibrate?.([10,30,10]);
    return;
  }
  if(selected===null){
    if(state[index].length){selected=index;navigator.vibrate?.(10);render();}
    return;
  }
  if(selected===index){selected=null;render();return;}
  if(isLocked(selected)||!canPour(state,selected,index)){
    selected=state[index].length?index:null;
    render();
    return;
  }

  const result=pour(state,selected,index);
  history.push(snapshot());
  state=result.state;
  selected=null;
  moves++;
  updateUnlock();
  navigator.vibrate?.(14);
  render();
  if(solved(state))setTimeout(showWin,80);
}

function startLevel(value=1){setupPuzzle(generate(config(value)),levelRules(value),value);}

function showWin(){
  const rating=stars(moves,par);
  const progress=JSON.parse(localStorage.getItem('sand-progress-v25')||'{}');
  progress[level]=Math.max(progress[level]||0,rating);
  localStorage.setItem('sand-progress-v25',JSON.stringify(progress));
  $('#winStars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);
  $('#winStats').textContent=`${moves} Züge · Par ${par}`;
  $('#winDialog').showModal();
}

$('#undo').onclick=()=>{
  if(!history.length||busy)return;
  restore(history.pop());
  moves=Math.max(0,moves-1);
  selected=null;
  render();
};
$('#restart').onclick=()=>{
  if(busy)return;
  state=clone(initial);
  history=[];
  selected=null;
  moves=0;
  lock.unlocked=!rules.bonusLock||complete(state[lock.trigger]);
  render();
};
$('#hint').onclick=()=>{
  if(busy)return;
  const candidates=[...solution];
  for(let from=0;from<state.length;from++)for(let to=0;to<state.length;to++)candidates.push({from,to});
  const move=candidates.find(move=>!isLocked(move.from)&&!isLocked(move.to)&&canPour(state,move.from,move.to));
  if(move){selected=move.from;render();}
};
$('#random').onclick=$('#settings').onclick=()=>$('#settingsDialog').showModal();
$('#startRandom').onclick=()=>{
  const puzzle=generate({colors:+$('#colors').value,empties:2,difficulty:+$('#difficulty').value,seed:Date.now()});
  setupPuzzle(puzzle,{hiddenTop:$('#hiddenRule').checked?1:0,bonusLock:$('#lockRule').checked},0);
  $('#settingsDialog').close();
};
$('#colors').oninput=event=>$('#colorsOut').textContent=event.target.value;
$('#difficulty').oninput=event=>$('#difficultyOut').textContent=['','Leicht','Mittel','Schwer'][event.target.value];
$('#levels').onclick=()=>{
  const grid=$('#levelGrid');
  const progress=JSON.parse(localStorage.getItem('sand-progress-v25')||'{}');
  grid.innerHTML='';
  for(let value=1;value<=60;value++){
    const button=document.createElement('button');
    const chapter=value<=6?'':value<=12?'◉':value<=18?'🔒':value<=30?'◉🔒':'?🔒';
    button.textContent=progress[value]?`${value} ${chapter}\n${'★'.repeat(progress[value])}`:`${value} ${chapter}`;
    button.className=progress[value]?'done':'';
    button.onclick=()=>{startLevel(value);$('#levelDialog').close();};
    grid.appendChild(button);
  }
  $('#levelDialog').showModal();
};
$('#next').onclick=()=>{startLevel(Math.min(60,level+1));$('#winDialog').close();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister()));
load()?render():startLevel(1);
