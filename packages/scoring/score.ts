type Eight={IQ:number;EQ:number;AQ:number;SQ:number;CQ:number;HQ:number;MQ:number;KQ:number};
type FCEA={F:number;C:number;E:number;A:number;entry_bias:Record<string,number>;transitions:Record<string,number>;E_stall:number;};
export type ScoreInput={answers36:number[];rtMs?:number[]};
export type ScoreOutput={eight:Eight;fcea:FCEA;pair_terms:Record<string,number>;OS:number;meta:{scoring_version:string;}};

export function scoreAnswers(input:ScoreInput, weights:any):ScoreOutput{
  const eight:Eight={IQ:0,EQ:0,AQ:0,SQ:0,CQ:0,HQ:0,MQ:0,KQ:0};
  const fceaSum={F:0,C:0,E:0,A:0}; let eStall=0;

  input.answers36.forEach((ans,i)=>{
    const w=weights["q"+(i+1)]?.[String(ans)]; if(!w) return;
    (Object.keys(eight) as (keyof Eight)[]).forEach(k=>eight[k]+=w[k]);
    (["F","C","E","A"] as const).forEach(k=>fceaSum[k]+=w[k]);
    if(weights.stall_items?.includes(i+1)) eStall+=(w.e_stall||0);
  });

  const [emin,emax]=weights.meta.minmax.eight, [fmin,fmax]=weights.meta.minmax.fcea;
  const norm=(v:number,min:number,max:number)=>Math.round(((v-min)/Math.max(1,(max-min)))*100);
  (Object.keys(eight) as (keyof Eight)[]).forEach(k=>eight[k]=norm(eight[k],emin,emax));
  (["F","C","E","A"] as const).forEach(k=>fceaSum[k]=norm(fceaSum[k],fmin,fmax));

  const pairs={
    IQxSQ:Math.round((eight.IQ*eight.SQ)*(weights.pair_terms.IQxSQ||0)/100),
    EQxKQ:Math.round((eight.EQ*eight.KQ)*(weights.pair_terms.EQxKQ||0)/100),
    CQxMQ:Math.round((eight.CQ*eight.MQ)*(weights.pair_terms.CQxMQ||0)/100),
    HQxAQ:Math.round((eight.HQ*eight.AQ)*(weights.pair_terms.HQxAQ||0)/100)
  };

  const avg8=Object.values(eight).reduce((a,b)=>a+b,0)/8;
  const OS=Math.max(0,Math.min(100,Math.round(avg8+Object.values(pairs).reduce((a,b)=>a+b,0)-eStall)));

  return {
    eight,
    fcea:{...fceaSum,entry_bias:{F:0,C:0,E:0,A:0},transitions:{"F→C":0,"C→E":0,"E→A":0,"A→F":0},E_stall:eStall},
    pair_terms:pairs,
    OS,
    meta:{scoring_version:weights.meta.scoring_version}
  };
}
