import { clone, generate, stars } from './engine.js?v=26';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=s=>document.querySelector(s),board=$('#board');
let state=[],initial=[],history=[],solution=[],capacities=[],roles=[],uses=[],selected=null,level=1,moves=0,par=20,busy=false;
let rules={hiddenTop:0,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
let lock={index:-1,trigger:-1,unlocked:true};

const complete=(tube,index)=>tube.length===capacities[index]&&tube.every(c=>c===tube[0]);
const solved=()=>state.every((tube,index)=>!tube.length||complete(tube,index));
const topRun=tube=>{if(!tube.length)return 0;let n=1;for(let i=tube.length-2;i>=0&&tube[i]===tube.at(-1);i--)n++;return n;};
const isLocked=index=>rules.bonusLock&&index===lock.index&&!lock.unlocked;
const canSource=index=>!isLocked(index)&&roles[index]!=='inputOnly'&&!(roles[index]==='oneUse'&&uses[index]>=1);
const canTarget=index=>!isLocked(index)&&roles[index]!=='outputOnly';
const canPour=(from,to)=>from!==to&&canSource(from)&&canTarget(to)&&state[from]?.length&&state[to]&&state[to].length<capacities[to]&&(!state[to].length||state[from].at(-1)===state[to].at(-1));
const pour=(from,to)=>{if(!canPour(from,to))return false;const amount=Math.min(topRun(state[from]),capacities[to]-state[to].length),color=state[from].at(-1);for(let i=0;i<amount;i++){state[from].pop();state[to].push(color);}uses[from]++;return true;};
const snapshot=()=>({state:clone(state),uses:[...uses],unlocked:lock.unlocked});
const restore=value=>{state=clone(value.state);uses=[...value.uses];lock.unlocked=value.unlocked;};

function levelRules(value){
  if(value<=6)return{hiddenTop:0,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
  if(value<=12)return{hiddenTop:2,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
  if(value<=18)return{hiddenTop:0,bonusLock:true,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
  if(value<=24)return{hiddenTop:1,bonusLock:false,small2:true,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
  if(value<=30)return{hiddenTop:1,bonusLock:false,small2:false,small3:true,large5:false,oneUse:true,inputOnly:false,outputOnly:false};
  if(value<=36)return{hiddenTop:1,bonusLock:false,small2:false,small3:false,large5:true,oneUse:false,inputOnly:true,outputOnly:false};
  if(value<=42)return{hiddenTop:0,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:true};
  return{hiddenTop:1,bonusLock:true,small2:true,small3:true,large5:true,oneUse:true,inputOnly:true,outputOnly:true};
}
function config(value){return{colors:Math.min(10,3+Math.floor((value-1)/8)),empties:2,difficulty:value<10?1:value<25?2:3,seed:value*7919+17};}
function addBonus(capacity){state.push([]);capacities.push(capacity);roles.push('normal');uses.push(0);}
function assignRoles(){
  const sourceCounts=Array(state.length).fill(0),targetCounts=Array(state.length).fill(0),taken=new Set();
  solution.forEach(move=>{if(move.from<sourceCounts.length)sourceCounts[move.from]++;if(move.to<targetCounts.length)targetCounts[move.to]++;});
  const pick=test=>state.findIndex((tube,index)=>!taken.has(index)&&test(tube,index));
  if(rules.oneUse){const i=pick((tube,index)=>tube.length&&sourceCounts[index]<=1);if(i>=0){roles[i]='oneUse';taken.add(i);}}
  if(rules.inputOnly){let i=pick((tube,index)=>targetCounts[index]>0&&sourceCounts[index]===0);if(i<0){addBonus(4);i=state.length-1;}roles[i]='inputOnly';taken.add(i);}
  if(rules.outputOnly){const i=pick((tube,index)=>tube.length&&targetCounts[index]===0);if(i>=0){roles[i]='outputOnly';taken.add(i);}}
}
function setupPuzzle(puzzle,nextRules,value=level){
  state=clone(puzzle.state);capacities=state.map(()=>4);roles=state.map(()=>'normal');uses=state.map(()=>0);solution=(puzzle.solution||[]).map(m=>({...m}));rules={...nextRules};
  if(rules.small2)addBonus(2);if(rules.small3)addBonus(3);if(rules.large5)addBonus(5);
  lock={index:-1,trigger:-1,unlocked:true};
  if(rules.bonusLock){lock.index=state.length;addBonus(4);lock.trigger=state.findIndex((tube,index)=>index!==lock.index&&tube.length>0&&!complete(tube,index));if(lock.trigger<0)lock.trigger=0;lock.unlocked=complete(state[lock.trigger],lock.trigger);}
  assignRoles();initial=clone(state);history=[];selected=null;moves=0;par=puzzle.par;level=value;render();
}
function save(){localStorage.setItem('sand-logic-v28',JSON.stringify({state,initial,history,solution,capacities,roles,uses,level,moves,par,rules,lock}));}
function load(){try{const v=JSON.parse(localStorage.getItem('sand-logic-v28'));if(!v?.state?.length)return false;({state,initial,history,solution,capacities,roles,uses,level,moves,par,rules,lock}=v);selected=null;return true;}catch{return false;}}
function updateUi(){
  $('#meta').textContent=`Level ${level} · ${moves} Züge`;const rating=stars(moves,par);$('#stars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);$('#undo').disabled=!history.length||busy;
  const items=[];if(rules.hiddenTop)items.push(`◉ Nur die obersten ${rules.hiddenTop} Schichten sichtbar`);if(rules.small2)items.push('② 2er-Bonusglas');if(rules.small3)items.push('③ 3er-Bonusglas');if(rules.large5)items.push('⑤ 5er-Bonusglas');if(rules.oneUse)items.push('① Einmal ausgießen');if(rules.inputOnly)items.push('↓ Nur eingießen');if(rules.outputOnly)items.push('↑ Nur ausgießen');if(rules.bonusLock)items.push(lock.unlocked?'🔓 Bonusglas offen':`🔒 Öffnet sich, wenn Glas ${lock.trigger+1} sortiert ist`);$('#rules').innerHTML=items.length?items.map(i=>`<span>${i}</span>`).join(''):'<span class="plain">Klassisches Sortieren</span>';save();
}
function layerHidden(tube,index){return rules.hiddenTop&&index<tube.length-rules.hiddenTop;}
function render(){
  board.innerHTML='';state.forEach((tube,index)=>{const b=document.createElement('button');b.type='button';b.className='tubeButton';b.style.setProperty('--capacity',capacities[index]);b.dataset.capacity=capacities[index];b.dataset.role=roles[index];if(index===selected)b.classList.add('selected');if(selected!==null&&canPour(selected,index))b.classList.add('valid');if(isLocked(index))b.classList.add('locked');if(index===lock.trigger&&!lock.unlocked)b.classList.add('trigger');if(roles[index]==='oneUse'&&uses[index]>=1)b.classList.add('spent');b.setAttribute('aria-label',`Glas ${index+1}, Kapazität ${capacities[index]}, ${roles[index]}`);
    tube.forEach((color,i)=>{const layer=document.createElement('span');layer.className='sandLayer';layer.style.setProperty('--i',i);layer.style.setProperty('--c',COLORS[color]);if(layerHidden(tube,i)){layer.classList.add('hiddenLayer');layer.textContent='?';}b.appendChild(layer);});
    const cap=document.createElement('span');cap.className='capacityBadge';cap.textContent=capacities[index];b.appendChild(cap);
    if(roles[index]!=='normal'){const badge=document.createElement('span');badge.className='roleBadge';badge.textContent=roles[index]==='oneUse'?(uses[index]?'×':'1'):roles[index]==='inputOnly'?'↓':'↑';b.appendChild(badge);}
    if(isLocked(index)){const badge=document.createElement('span');badge.className='lockBadge';badge.textContent='🔒';b.appendChild(badge);}if(index===lock.trigger&&!lock.unlocked){const badge=document.createElement('span');badge.className='goalBadge';badge.textContent='1';b.appendChild(badge);}b.onclick=()=>tap(index);board.appendChild(b);
  });updateUi();
}
function updateUnlock(){if(rules.bonusLock&&!lock.unlocked&&complete(state[lock.trigger],lock.trigger)){lock.unlocked=true;navigator.vibrate?.([20,30,20]);}}
function tap(index){
  if(busy||isLocked(index))return;if(selected===null){if(state[index].length&&canSource(index)){selected=index;render();}return;}if(selected===index){selected=null;render();return;}if(!canPour(selected,index)){selected=state[index].length&&canSource(index)?index:null;render();return;}
  history.push(snapshot());pour(selected,index);selected=null;moves++;updateUnlock();render();if(solved())setTimeout(showWin,80);
}
function startLevel(value=1){setupPuzzle(generate(config(value)),levelRules(value),value);}
function showWin(){const rating=stars(moves,par),progress=JSON.parse(localStorage.getItem('sand-progress-v28')||'{}');progress[level]=Math.max(progress[level]||0,rating);localStorage.setItem('sand-progress-v28',JSON.stringify(progress));$('#winStars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);$('#winStats').textContent=`${moves} Züge · Par ${par}`;$('#winDialog').showModal();}

$('#undo').onclick=()=>{if(!history.length||busy)return;restore(history.pop());moves=Math.max(0,moves-1);selected=null;render();};
$('#restart').onclick=()=>{if(busy)return;state=clone(initial);history=[];uses=uses.map(()=>0);selected=null;moves=0;lock.unlocked=!rules.bonusLock||complete(state[lock.trigger],lock.trigger);render();};
$('#hint').onclick=()=>{if(busy)return;for(let from=0;from<state.length;from++)for(let to=0;to<state.length;to++)if(canPour(from,to)){selected=from;render();return;}};
$('#random').onclick=$('#settings').onclick=()=>$('#settingsDialog').showModal();
$('#startRandom').onclick=()=>{const puzzle=generate({colors:+$('#colors').value,empties:2,difficulty:+$('#difficulty').value,seed:Date.now()});setupPuzzle(puzzle,{hiddenTop:$('#hiddenRule').checked?1:0,bonusLock:$('#lockRule').checked,small2:$('#smallTubeRule').checked,small3:$('#mediumTubeRule').checked,large5:$('#largeTubeRule').checked,oneUse:$('#oneUseRule').checked,inputOnly:$('#inputOnlyRule').checked,outputOnly:$('#outputOnlyRule').checked},0);$('#settingsDialog').close();};
$('#colors').oninput=e=>$('#colorsOut').textContent=e.target.value;$('#difficulty').oninput=e=>$('#difficultyOut').textContent=['','Leicht','Mittel','Schwer'][e.target.value];
$('#levels').onclick=()=>{const grid=$('#levelGrid'),progress=JSON.parse(localStorage.getItem('sand-progress-v28')||'{}');grid.innerHTML='';for(let value=1;value<=60;value++){const b=document.createElement('button');b.textContent=progress[value]?`${value}\n${'★'.repeat(progress[value])}`:value;b.className=progress[value]?'done':'';b.onclick=()=>{startLevel(value);$('#levelDialog').close();};grid.appendChild(b);}$('#levelDialog').showModal();};
$('#next').onclick=()=>{startLevel(Math.min(60,level+1));$('#winDialog').close();};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));load()?render():startLevel(1);