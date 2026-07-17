import { clone, generate, stars } from './engine.js?v=26';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=s=>document.querySelector(s),board=$('#board');
let state=[],initial=[],history=[],capacities=[],roles=[],selected=null,level=1,moves=0,par=20,busy=false;
let rules={hiddenTop:0,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
let lock={index:-1,trigger:-1,unlocked:true};
let outUses=[];

const complete=(tube,index)=>tube.length===capacities[index]&&tube.every(c=>c===tube[0]);
const solved=()=>state.every((tube,index)=>!tube.length||complete(tube,index));
const topRun=tube=>{if(!tube.length)return 0;let n=1;for(let i=tube.length-2;i>=0&&tube[i]===tube.at(-1);i--)n++;return n;};
const isLocked=index=>rules.bonusLock&&index===lock.index&&!lock.unlocked;
const canSource=index=>!isLocked(index)&&roles[index]!=='inputOnly'&&!(roles[index]==='oneUse'&&outUses[index]>=1);
const canTarget=index=>!isLocked(index)&&roles[index]!=='outputOnly';
const canPour=(from,to)=>from!==to&&canSource(from)&&canTarget(to)&&state[from]?.length&&state[to]&&state[to].length<capacities[to]&&(!state[to].length||state[from].at(-1)===state[to].at(-1));
const pour=(from,to)=>{if(!canPour(from,to))return false;const amount=Math.min(topRun(state[from]),capacities[to]-state[to].length),color=state[from].at(-1);for(let i=0;i<amount;i++){state[from].pop();state[to].push(color);}outUses[from]++;return true;};
const snapshot=()=>({state:clone(state),outUses:[...outUses],unlocked:lock.unlocked});
const restore=v=>{state=clone(v.state);outUses=[...v.outUses];lock.unlocked=v.unlocked;};

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
function config(value,custom){
  if(custom)return custom;
  return{colors:Math.min(10,3+Math.floor((value-1)/8)),empties:2,difficulty:value<10?1:value<25?2:3,seed:value*7919+17};
}
function assignSpecials(puzzle){
  const solution=puzzle.solution||[],sources=Array(state.length).fill(0),targets=Array(state.length).fill(0),taken=new Set();
  solution.forEach(m=>{sources[m.from]++;targets[m.to]++;});
  const pick=test=>state.findIndex((tube,i)=>!taken.has(i)&&test(tube,i));
  if(rules.oneUse){const i=pick((tube,index)=>tube.length&&sources[index]===1);if(i>=0){roles[i]='oneUse';taken.add(i);}}
  if(rules.inputOnly){const i=pick((tube,index)=>targets[index]>0&&sources[index]===0);if(i>=0){roles[i]='inputOnly';taken.add(i);}}
  if(rules.outputOnly){const i=pick((tube,index)=>sources[index]>0&&targets[index]===0);if(i>=0){roles[i]='outputOnly';taken.add(i);}}
  const empty=()=>state.findIndex((tube,i)=>!taken.has(i)&&tube.length===0);
  if(rules.small2){const i=empty();if(i>=0){capacities[i]=2;taken.add(i);}}
  if(rules.small3){const i=empty();if(i>=0){capacities[i]=3;taken.add(i);}}
  if(rules.large5){const i=empty();if(i>=0){capacities[i]=5;taken.add(i);}}
}
function setupPuzzle(puzzle,nextRules,value=level){
  state=clone(puzzle.state);capacities=state.map(()=>4);roles=state.map(()=>'normal');outUses=state.map(()=>0);rules={...nextRules};
  assignSpecials(puzzle);
  lock={index:-1,trigger:-1,unlocked:true};
  if(rules.bonusLock){lock.index=state.findIndex(t=>t.length===0);lock.trigger=state.findIndex((tube,index)=>index!==lock.index&&tube.length>0&&!complete(tube,index));lock.unlocked=lock.index<0||complete(state[lock.trigger],lock.trigger);}
  initial=clone(state);history=[];selected=null;moves=0;par=puzzle.par;level=value;render();
}
function startLevel(value=1,custom=null,nextRules=levelRules(value)){setupPuzzle(generate(config(value,custom)),nextRules,value);}
function save(){localStorage.setItem('sand-logic-v30',JSON.stringify({state,initial,history,capacities,roles,outUses,level,moves,par,rules,lock}));}
function load(){try{const v=JSON.parse(localStorage.getItem('sand-logic-v30'));if(!v?.state?.length)return false;({state,initial,history,capacities,roles,outUses,level,moves,par,rules,lock}=v);selected=null;return true;}catch{return false;}}
function updateUi(){
  $('#meta').textContent=`Level ${level} · ${moves} Züge`;const rating=stars(moves,par);$('#stars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);$('#undo').disabled=!history.length||busy;
  const items=[];if(rules.hiddenTop)items.push(`◉ Nur die obersten ${rules.hiddenTop} Schichten sichtbar`);if(rules.oneUse)items.push('① Einmal ausgießen');if(rules.inputOnly)items.push('⇩ Nur hineingießen');if(rules.outputOnly)items.push('⇧ Nur herausgießen');if(rules.small2)items.push('② Kleines Glas');if(rules.small3)items.push('③ Mittleres Glas');if(rules.large5)items.push('⑤ Großes Glas');if(rules.bonusLock)items.push(lock.unlocked?'🔓 Glas entsperrt':`🔒 Erst Glas ${lock.trigger+1} sortieren`);$('#rules').innerHTML=items.length?items.map(i=>`<span>${i}</span>`).join(''):'<span class="plain">Klassisches Sortieren</span>';save();
}
function render(){
  board.innerHTML='';state.forEach((tube,index)=>{const b=document.createElement('button');b.type='button';b.className='tubeButton';b.style.setProperty('--capacity',capacities[index]);b.dataset.capacity=capacities[index];b.dataset.role=roles[index];if(index===selected)b.classList.add('selected');if(selected!==null&&canPour(selected,index))b.classList.add('valid');if(isLocked(index))b.classList.add('locked');if(roles[index]==='oneUse'&&outUses[index]>=1)b.classList.add('spent');
    tube.forEach((color,i)=>{const layer=document.createElement('span');layer.className='sandLayer';layer.style.setProperty('--i',i);layer.style.setProperty('--c',COLORS[color]);if(rules.hiddenTop&&i<tube.length-rules.hiddenTop){layer.classList.add('hiddenLayer');layer.textContent='?';}b.appendChild(layer);});
    if(capacities[index]!==4){const cap=document.createElement('span');cap.className='capacityBadge';cap.textContent=capacities[index];b.appendChild(cap);}if(roles[index]!=='normal'){const badge=document.createElement('span');badge.className='roleBadge';badge.textContent=roles[index]==='oneUse'?(outUses[index]?'×':'①'):roles[index]==='inputOnly'?'⇩':'⇧';b.appendChild(badge);}if(isLocked(index)){const badge=document.createElement('span');badge.className='lockBadge';badge.textContent='🔒';b.appendChild(badge);}b.onclick=()=>tap(index);board.appendChild(b);
  });updateUi();
}
function updateUnlock(){if(rules.bonusLock&&!lock.unlocked&&lock.trigger>=0&&complete(state[lock.trigger],lock.trigger))lock.unlocked=true;}
function tap(index){
  if(busy||isLocked(index))return;if(selected===null){if(state[index].length&&canSource(index)){selected=index;render();}return;}if(selected===index){selected=null;render();return;}if(!canPour(selected,index)){selected=state[index].length&&canSource(index)?index:null;render();return;}history.push(snapshot());pour(selected,index);selected=null;moves++;updateUnlock();render();if(solved())setTimeout(showWin,80);
}
function showWin(){const rating=stars(moves,par),progress=JSON.parse(localStorage.getItem('sand-progress-v30')||'{}');progress[level]=Math.max(progress[level]||0,rating);localStorage.setItem('sand-progress-v30',JSON.stringify(progress));$('#winStars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);$('#winStats').textContent=`${moves} Züge · Par ${par}`;$('#winDialog').showModal();}

$('#undo').onclick=()=>{if(!history.length||busy)return;restore(history.pop());moves=Math.max(0,moves-1);selected=null;render();};
$('#restart').onclick=()=>{state=clone(initial);history=[];outUses=outUses.map(()=>0);selected=null;moves=0;lock.unlocked=!rules.bonusLock||lock.trigger<0||complete(state[lock.trigger],lock.trigger);render();};
$('#hint').onclick=()=>{for(let from=0;from<state.length;from++)for(let to=0;to<state.length;to++)if(canPour(from,to)){selected=from;render();return;}};
$('#random').onclick=$('#settings').onclick=()=>$('#settingsDialog').showModal();
$('#startRandom').onclick=()=>{const nextRules={hiddenTop:$('#hiddenRule').checked?1:0,bonusLock:$('#lockRule').checked,small2:$('#smallTubeRule').checked,small3:$('#mediumTubeRule').checked,large5:$('#largeTubeRule').checked,oneUse:$('#oneUseRule').checked,inputOnly:$('#inputOnlyRule').checked,outputOnly:$('#outputOnlyRule').checked};const custom={colors:+$('#colors').value,empties:2,difficulty:+$('#difficulty').value,seed:Date.now()};startLevel(0,custom,nextRules);$('#settingsDialog').close();};
$('#colors').oninput=e=>$('#colorsOut').textContent=e.target.value;$('#difficulty').oninput=e=>$('#difficultyOut').textContent=['','Leicht','Mittel','Schwer'][e.target.value];
$('#levels').onclick=()=>{const grid=$('#levelGrid'),progress=JSON.parse(localStorage.getItem('sand-progress-v30')||'{}');grid.innerHTML='';for(let value=1;value<=60;value++){const b=document.createElement('button');b.textContent=progress[value]?`${value}\n${'★'.repeat(progress[value])}`:value;b.className=progress[value]?'done':'';b.onclick=()=>{startLevel(value);$('#levelDialog').close();};grid.appendChild(b);}$('#levelDialog').showModal();};
$('#next').onclick=()=>{startLevel(Math.min(60,level+1));$('#winDialog').close();};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));load()?render():startLevel(1);
