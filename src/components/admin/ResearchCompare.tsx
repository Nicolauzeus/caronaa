import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import type {ResearchForm} from "@/lib/formulario/research-catalog";
type Brief={total:number;profiles:{category:string;total:number}[]};
export function ResearchCompare({forms}:{forms:ResearchForm[]}){
 const [first,setFirst]=useState(""),[second,setSecond]=useState("");
 const [left,setLeft]=useState<Brief|null>(null),[right,setRight]=useState<Brief|null>(null),[error,setError]=useState("");
 useEffect(()=>{if(!first||!second||first===second){setLeft(null);setRight(null);return;}let active=true;
 void Promise.all([first,second].map(p_form_id=>(supabase as any).rpc("get_research_bi",{p_form_id,p_nature:null,p_profile:null,p_occupation:null}))).then(([a,b]:any[])=>{if(!active)return;if(a.error||b.error){setError(a.error?.message??b.error?.message);return;}setError("");setLeft(a.data);setRight(b.data);});
 return()=>{active=false};},[first,second]);
 const metrics=[["PASSAGEIRO","Passageiros"],["MOTORISTA","Motoristas"],["AMBOS","Ambos (histórico)"]];
 const pct=(n:number,t:number)=>t?((n/t)*100).toFixed(1)+"%":"N/D";
 const value=(d:Brief|null,k:string)=>d?.profiles?.find(p=>p.category===k)?.total??0;
 return <section className="space-y-4 rounded-2xl border p-4">
 <div><h3 className="text-lg font-bold">Comparar pesquisas</h3><p className="text-sm text-muted-foreground">Compare amostras e perfis. Não confunda diferença de participantes com mudança causal na mobilidade.</p></div>
 {forms.length<2?<p className="text-sm text-muted-foreground">Crie pelo menos duas pesquisas para comparar resultados.</p>:<>
 <div className="grid gap-3 sm:grid-cols-2">{[[first,setFirst,"Pesquisa A"],[second,setSecond,"Pesquisa B"]].map(([value,setValue,label],i)=><label className="text-sm" key={i}>{label as string}<select className="mt-1 w-full rounded-lg border bg-background p-3" value={value as string} onChange={e=>(setValue as (s:string)=>void)(e.target.value)}><option value="">Escolha</option>{forms.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label>)}</div>
 {first===second&&first&&<p className="text-sm text-muted-foreground">Escolha pesquisas diferentes.</p>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {left&&right&&<div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr><th className="p-3">Métrica</th><th className="p-3">Pesquisa A</th><th className="p-3">Pesquisa B</th></tr></thead><tbody><tr className="border-t"><td className="p-3">Respostas</td><td className="p-3">{left.total}</td><td className="p-3">{right.total}</td></tr>{metrics.map(([k,label])=><tr key={k} className="border-t"><td className="p-3">{label}</td><td className="p-3">{value(left,k)} · {pct(value(left,k),left.total)}</td><td className="p-3">{value(right,k)} · {pct(value(right,k),right.total)}</td></tr>)}</tbody></table><p className="mt-2 text-xs text-muted-foreground">Comparação apenas de perfis compatíveis. Dores e perguntas específicas exigem catálogo semântico equivalente.</p></div>}
 </>}
 </section>;
}
