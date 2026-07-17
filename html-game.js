import { clone, generate, stars } from './engine.js?v=26';

const COLORS=['#ff5264','#ff9b38','#ffd43b','#4ed17c','#36bfe8','#6576f4','#9b58e7','#ee63b5','#8d6347','#4bd4c3'];
const $=s=>document.querySelector(s),board=$('#board');
let state=[],initial=[],history=[],solution=[],capacities=[],roles=[],specials=[],outUses=[],inUses=[],selected=null,level=1,moves=0,par=20,busy=false;
let rules={hiddenTop:0,bonusLock:false,small2:false,small3:false,large5:false,oneUse:false,inputOnly:false,outputOnly:false};
let lock={index:-1,trigger:-1,unlocked:true};

const complete=(tube,index)=>tube.length===capacities[index]&&tube.every(c=>c===tube[0]);
const topRun=tube=>{if(!tube.length)return 0;let n=1;for(let i=tube.length-2;i>=0&&tube[i]===tube.at(-1);i--)n++;return n;};
const isLocked=index=>rules.bonusLock&&index===lock.index&&!lock.unlocked;
const canSource=index=>!isLocked(index)&&roles[index]!=='inputOnly'&&!(roles[index]==='oneUse'&&outUses[index]>=1);
const canTarget=index=>!isLocked(index)&&roles[index]!=='outputOnly';
const canPour=(from,to)=>from!==to&&canSource(from)&&canTarget(to)&&state[from]?.length&&state[to]&&state[to].length<capacities[to]&&(!state[to].length||state[from].at(-1)===state[to].at(-1));
const requirementMet=index=>{
  if(roles[index]==='oneUse')return outUses[index]===1;
  if(roles[index]==='inputOnly')return inUses[index]>0;
  if(roles[index]==='outputOnly')return outUses[index]>0;
  if(specials[index])return inUses[index]+outUses[index]>0;
  return true;
};
const solved=()=>state.every((tube,index)=>!tube.length||complete(tube,index))&&state.every((_,index)=>requirementMet(index))&&(!rules.bonusLock||lock.unlocked);
const pour=(from,to)=>{if(!canPour(from,to))return false;const amount=Math.min(topRun(state[from]),capacities[to]-state[to].length),color=state[from].at(-1);for(let i=0;i<amount;i++){state[from].pop();state[to].push(color);}outUses[from]++;inUses[to]++;return true;};
const snapshot=()=>({state:clone(state),outUses:[...outUses],inUses:[...inUses],unlocked:lock.unlocked});
const restore=value=>{state=clone(value.state);outUses=[...value.outUses];inUses=[...value.inUses];lock.unlocked=value.unlocked;};

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
function config(value,seedOffset=0){return{colors:Math.min(10,3+Math.floor((value-1)/8)),empties:2,difficulty:value<10?1:value<25?2:3,seed:value*7919+17+seedOffset};}
function addBonus(capacity,kind){state.push([]);capacities.push(capacity);roles.push('normal');specials.push(kind);outUses.push(0);inUses.push(0);return state.length-1;}
function assignRoles(){
  const sourceCounts=Array(state.length).fill(0),targetCounts=Array(state.length).fill(0),taken=new Set();
  solution.forEach(move=>{sourceCounts[move.from]++;targetCounts[move.to]++;});
  const pick=test=>state.findIndex((tube,index)=>!taken.has(index)&&test(tube,index));
  if(rules.oneUse){const i=pick((tube,index)=>tube.length&&sourceCounts[index]===1);if(i<0)return false;roles[i]='oneUse';specials[i]='oneUse';taken.add(i);}
  if(rules.inputOnly){const i=pick((tube,index)=>targetCounts[index]>0&&sourceCounts[index]===0);if(i<0)return false;roles[i]='inputOnly';specials[i]='inputOnly';taken.add(i);}
  if(rules.outputOnly){const i=pick((tube,index)=>sourceCounts[index]>0&&targetCounts[index]===0);if(i<0)return false;roles[i]='outputOnly';specials[i]='outputOnly';taken.add(i);}
  return true;
}
function setupPuzzle(puzzle,nextRules,value=level){
  state=clone(puzzle.state);capacities=state.map(()=>4);roles=state.map(()=>'normal');specials=state.map(()=>null);outUses=state.map(()=>0);inUses=state.map(()=>0);solution=(puzzle.solution||[]).map(m=>({...m}));rules={...nextRules};
  if(!assignRoles())return false;
  if(rules.small2)addBonus(2,'size2');if(rules.small3)addBonus(3,'size3');if(rules.large5)addBonus(5,'size5');
  lock={index:-1,trigger:-1,unlocked:true};
  if(rules.bonusLock){lock.index=addBonus(4,'locked');lock.trigger=state.findIndex((tube,index)=>index!==lock.index&&tube.length>0&&!complete(tube,index));if(lock.trigger<0)lock.trigger=0;lock.unlocked=complete(state[lock.trigger],lock.trigger);}
  initial=clone(state);history=[];selected=null;moves=0;par=puzzle.par+specials.filter(Boolean).length;level=value;render();return true;
}
function startGenerated(nextRules,value=level,custom=null){for(let attempt=0;attempt<200;attempt++){const puzzle=generate(custom?{...custom,seed:custom.seed+attempt}:config(value,attempt));if(setupPuzzle(puzzle,nextRules,value))return;}alert('Für diese Regelkombination konnte kein garantiert lösbares Puzzle erzeugt werden. Bitte eine Regel weniger wählen.');}
function save(){localStorage.setItem('sand-logic-v29',JSON.stringify({state,initial,history,solution,capacities,roles,specials,outUses,inUses,level,moves,par,rules,lock}));}
function load(){try{const v=JSON.parse(localStorage.getItem('sand-logic-v29'));if(!v?.state?.length)return false;({state,initial,history,solution,capacities,roles,specials,outUses,inUses,level,moves,par,rules,lock}=v);selected=null;return true;}catch{return false;}}
function ruleText(index){if(roles[index]==='oneUse')return outUses[index]?'Verbraucht: Dieses Glas kann nicht mehr ausgießen.':'Einweg: Genau einmal aus diesem Glas ausgießen.';if(roles[index]==='inputOnly')return 'Einbahnstraße hinein: Sand darf nur in dieses Glas gegossen werden.';if(roles[index]==='outputOnly')return 'Einbahnstraße hinaus: Sand darf nur aus diesem Glas gegossen werden.';if(specials[index]==='size2')return '2er-Glas: Fasst zwei Schichten und muss benutzt werden.';if(specials[index]==='size3')return '3er-Glas: Fasst drei Schichten und muss benutzt werden.';if(specials[index]==='size5')return '5er-Glas: Fasst fünf Schichten und muss benutzt werden.';if(specials[index]==='locked')return lock.unlocked?'Entsperrtes Bonusglas: Es muss mindestens einmal benutzt werden.':`Gesperrt: Sortiere zuerst Glas ${lock.trigger+1}.`;return '';}
function updateUi(){
  $('#meta').textContent=`Level ${level} · ${moves} Züge`;const rating=stars(moves,par);$('#stars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);$('#undo').disabled=!history.length||busy;
  const items=[];if(rules.hiddenTop)items.push('◉ Verdeckte Schichten werden erst oben sichtbar.');if(rules.oneUse)items.push('① Einweg: genau einmal ausgießen.');if(rules.inputOnly)items.push('⇩ Nur hinein: darf nicht ausgießen.');if(rules.outputOnly)items.push('⇧ Nur hinaus: darf nichts aufnehmen.');if(rules.small2||rules.small3||rules.large5)items.push('◫ Jedes Sondergrößen-Glas muss benutzt werden.');if(rules.bonusLock)items.push(lock.unlocked?'🔓 Bonusglas offen – jetzt benutzen.':`🔒 Glas ${lock.trigger+1} sortieren, dann Bonusglas benutzen.`);items.push('✓ Alle aktiven Sonderregeln sind Pflicht für den Sieg.');$('#rules').innerHTML=items.map(i=>`<span>${i}</span>`).join('');save();
}
function layerHidden(tube,index){return rules.hiddenTop&&index<tube.length-rules.hiddenTop;}
function render(){
  board.innerHTML='';state.forEach((tube,index)=>{const b=document.createElement('button');b.type='button';b.className='tubeButton';b.style.setProperty('--capacity',capacities[index]);b.dataset.capacity=capacities[index];b.dataset.role=roles[index];b.dataset.special=specials[index]||'';if(index===selected)b.classList.add('selected');if(selected!==null&&canPour(selected,index))b.classList.add('valid');if(isLocked(index))b.classList.add('locked');if(index===lock.trigger&&!lock.unlocked)b.classList.add('trigger');if(requirementMet(index)&&specials[index])b.classList.add('fulfilled');if(roles[index]==='oneUse'&&outUses[index]>=1)b.classList.add('spent');b.setAttribute('aria-label',`Glas ${index+1}. ${ruleText(index)||'Normales Glas'}`);b.title=ruleText(index);
    tube.forEach((color,i)=>{const layer=document.createElement('span');layer.className='sandLayer';layer.style.setProperty('--i',i);layer.style.setProperty('--c',COLORS[color]);if(layerHidden(tube,i)){layer.classList.add('hiddenLayer');layer.textContent='?';}b.appendChild(layer);});
    if(capacities[index]!==4){const cap=document.createElement('span');cap.className='capacityBadge';cap.textContent=capacities[index];b.appendChild(cap);}
    if(specials[index]){const badge=document.createElement('span');badge.className='roleBadge';badge.textContent=roles[index]==='oneUse'?(outUses[index]?'×':'①'):roles[index]==='inputOnly'?'⇩':roles[index]==='outputOnly'?'⇧':specials[index]==='locked'?'🔒':'◫';b.appendChild(badge);}
    if(isLocked(index)){const badge=document.createElement('span');badge.className='lockBadge';badge.textContent='🔒';b.appendChild(badge);}if(index===lock.trigger&&!lock.unlocked){const badge=document.createElement('span');badge.className='goalBadge';badge.textContent='✓';b.appendChild(badge);}b.onclick=()=>tap(index);board.appendChild(b);
  });updateUi();
}
function updateUnlock(){if(rules.bonusLock&&!lock.unlocked&&complete(state[lock.trigger],lock.trigger)){lock.unlocked=true;navigator.vibrate?.([20,30,20]);}}
function tap(index){
  if(busy||isLocked(index))return;if(selected===null){if(state[index].length&&canSource(index)){selected=index;render();}return;}if(selected===index){selected=null;render();return;}if(!canPour(selected,index)){selected=state[index].length&&canSource(index)?index:null;render();return;}
  history.push(snapshot());pour(selected,index);selected=null;moves++;updateUnlock();render();if(solved())setTimeout(showWin,80);
}
function startLevel(value=1){startGenerated(levelRules(value),value);}
function showWin(){const rating=stars(moves,par),progress=JSON.parse(localStorage.getItem('sand-progress-v29')||'{}');progress[level]=Math.max(progress[level]||0,rating);localStorage.setItem('sand-progress-v29',JSON.stringify(progress));$('#winStars').textContent='★'.repeat(rating)+'☆'.repeat(3-rating);$('#winStats').textContent=`${moves} Züge · Par ${par} · alle Sonderregeln erfüllt`;$('#winDialog').showModal();}

$('#undo').onclick=()=>{if(!history.length||busy)return;restore(history.pop());moves=Math.max(0,moves-1);selected=null;render();};
$('#restart').onclick=()=>{if(busy)return;state=clone(initial);history=[];outUses=outUses.map(()=>0);inUses=inUses.map(()=>0);selected=null;moves=0;lock.unlocked=!rules.bonusLock||complete(state[lock.trigger],lock.trigger);render();};
$('#hint').onclick=()=>{if(busy)return;for(let from=0;from<state.length;from++)for(let to=0;to<state.length;to++)if(canPour(from,to)){selected=from;render();return;}};
$('#random').onclick=$('#settings').onclick=()=>$('#settingsDialog').showModal();
$('#startRandom').onclick=()=>{const nextRules={hiddenTop:$('#hiddenRule').checked?1:0,bonusLock:$('#lockRule').checked,small2:$('#smallTubeRule').checked,small3:$('#mediumTubeRule').checked,large5:$('#largeTubeRule').checked,oneUse:$('#oneUseRule').checked,inputOnly:$('#inputOnlyRule').checked,outputOnly:$('#outputOnlyRule').checked};startGenerated(nextRules,0,{colors:+$('#colors').value,empties:2,difficulty:+$('#difficulty').value,seed:Date.now()});$('#settingsDialog').close();};
$('#colors').oninput=e=>$('#colorsOut').textContent=e.target.value;$('#difficulty').oninput=e=>$('#difficultyOut').textContent=['','Leicht','Mittel','Schwer'][e.target.value];
$('#levels').onclick=()=>{const grid=$('#levelGrid'),progress=JSON.parse(localStorage.getItem('sand-progress-v29')||'{}');grid.innerHTML='';for(let value=1;value<=60;value++){const b=document.createElement('button');b.textContent=progress[value]?`${value}\n${'★'.repeat(progress[value])}`:value;b.className=progress[value]?'done':'';b.onclick=()=>{startLevel(value);$('#levelDialog').close();};grid.appendChild(b);}$('#levelDialog').showModal();};
$('#next').onclick=()=>{startLevel(Math.min(60,level+1));$('#winDialog').close();};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));load()?render():startLevel(1);