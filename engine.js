export const CAP=4;
export const clone=state=>state.map(tube=>[...tube]);
export const solved=state=>state.every(tube=>tube.length===0||(tube.length===CAP&&tube.every(color=>color===tube[0])));

export function run(tube){
  if(!tube.length)return 0;
  const color=tube[tube.length-1];
  let count=1;
  for(let i=tube.length-2;i>=0&&tube[i]===color;i--)count++;
  return count;
}

export function canPour(state,from,to){
  if(from===to||!state[from]?.length||!state[to]||state[to].length>=CAP)return false;
  return state[to].length===0||state[from][state[from].length-1]===state[to][state[to].length-1];
}

export function pour(state,from,to){
  if(!canPour(state,from,to))return null;
  const next=clone(state);
  const amount=Math.min(run(next[from]),CAP-next[to].length);
  const color=next[from][next[from].length-1];
  for(let i=0;i<amount;i++)next[to].push(next[from].pop());
  return{state:next,amount,color};
}

function randomFor(seed){
  let value=seed>>>0;
  return()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);
}

function replay(initial,solution){
  let state=clone(initial);
  for(const move of solution){
    const result=pour(state,move.from,move.to);
    if(!result)return null;
    state=result.state;
  }
  return state;
}

export function generate({colors=5,empties=2,difficulty=2,seed=1}={}){
  const random=randomFor(seed);
  const state=Array.from({length:colors},(_,color)=>Array(CAP).fill(color));
  for(let i=0;i<empties;i++)state.push([]);
  const solution=[];
  const target=colors*[0,7,13,21][difficulty];
  let previous=null;

  for(let step=0;step<target;step++){
    const candidates=[];
    for(let from=0;from<state.length;from++){
      if(!state[from].length)continue;
      const topCount=run(state[from]);
      for(let to=0;to<state.length;to++){
        if(from===to||state[to].length>=CAP)continue;
        const color=state[from][state[from].length-1];
        if(state[to].length&&state[to][state[to].length-1]===color)continue;
        const max=Math.min(topCount,CAP-state[to].length);
        for(let amount=1;amount<=max;amount++){
          if(amount===topCount&&amount<state[from].length)continue;
          if(previous&&previous.from===to&&previous.to===from&&previous.amount===amount)continue;
          if(state[from].length===amount&&state[to].length===0)continue;
          candidates.push({from,to,amount});
        }
      }
    }
    if(!candidates.length)break;
    const move=candidates[Math.floor(random()*candidates.length)];
    for(let i=0;i<move.amount;i++)state[move.to].push(state[move.from].pop());
    solution.unshift({from:move.to,to:move.from});
    previous=move;
  }

  const order=[...state.keys()];
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  const remap=new Map(order.map((oldIndex,newIndex)=>[oldIndex,newIndex]));
  const shuffled=order.map(index=>state[index]);
  const mappedSolution=solution.map(move=>({from:remap.get(move.from),to:remap.get(move.to)}));
  const verified=replay(shuffled,mappedSolution);
  if(solved(shuffled)||!verified||!solved(verified))return generate({colors,empties,difficulty,seed:seed+1});
  return{state:shuffled,solution:mappedSolution,par:Math.max(colors*2,mappedSolution.length)};
}

export function stars(moves,par){
  if(moves<=par)return 3;
  if(moves<=Math.ceil(par*1.45))return 2;
  return 1;
}
