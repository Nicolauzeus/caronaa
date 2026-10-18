import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {EvidenceChart} from "@/components/admin/EvidenceChart";
import type {ResearchForm} from "@/lib/formulario/research-catalog";
type Brief={total:number;profiles:{category:string;total:number}[]};
type Sem={semantic_code:string;category:string;total:number};
export function ResearchCompare({forms}:{forms:ResearchForm[]}){
 const [first,setFirst]=useState(""),[second,setSecond]=useState(""),[left,setLeft]=useState<Brief|null>(null),[right,setRight]=useState<Brief|null>(null),[lSem,setLSem]=useState<Sem[]>([]),[rSem,setRSem]=useState<Sem[]>([]),[code,setCode]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{if(!first||!second||first===second){setLeft(null);setRight(null);setLSem([]);setRSem([]);return}let active=true;setLoading(true);setError("");
 void Promise.all([first,second].flatMap(id=>[(supabase as any).rpc("get_research_unified_bi",{p_form_id:id,p_nature:null,p_profile:null,p_occupation:null,p_pain_code:null}),(supabase as any).rpc("get_research_semantic_summary",{p_form_id:id})])).then(([a,c,b,d]:any[])=>{
 if(!active)return;if([a,b,c,d].some(x=>x.error)){setError([a,b,c,d].find(x=>x.error)?.error.message??"Dados indisponíveis");setLeft(null);setRight(null);return}
 setLeft(a.data);setRight(b.data);setLSem(c.data??[]);setRSem(d.data??[]);
 }).catch(()=>{if(active)setError("Falha ao comparar pesquisas")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[first,second]);
 const metrics=[["PASSAGEIRO","Passageiros"],["MOTORISTA","Motoristas"],["AMBOS","Ambos (histórico)"]];
 const pct=(n:number,t:number)=>t?((n/t)*100).toFixed(1)+"%":"N/D";
 const value=(d:Brief|null,k:string)=>d?.profiles?.find(p=>p.category===k)?.total??0;
 const comparable=useMemo(()=>[...new Set(lSem.map(x=>x.semantic_code))].filter(x=>rSem.some(y=>y.semantic_code===x)),[lSem,rSem]);
 const selected=comparable.includes(code)?code:comparable[0];
 const rows=useMemo(()=>{if(!selected)return[];const a=lSem.filter(x=>x.semantic_code===selected),b=rSem.filter(x=>x.semantic_code===selected);
 return [...new Set([...a.map(x=>x.category),...b.map(x=>x.category)])].map(name=>({name,"Pesquisa A":Number(a.find(x=>x.category===name)?.total??0),"Pesquisa B":Number(b.find(x=>x.category===name)?.total??0)}))},[selected,lSem,rSem]);
 return <section className="space-y-4 rounded-xl border p-4"><h2 className="text-xl font-bold">Comparar pesquisas</h2><p className="text-sm text-muted-foreground">Estudos com amostras distintas não demonstram causalidade. Os indicadores semânticos só aparecem quando a classificação é compatível em ambos.</p>
 <div className="grid gap-3 sm:grid-cols-2">{[[first,setFirst,"Pesquisa A"],[second,setSecond,"Pesquisa B"]].map(([value,setValue,label],i)=><label className="text-sm" key={i}>{label as string}<select className="mt-1 w-full rounded-lg border bg-background p-3" value={value as string} onChange={e=>(setValue as (s:string)=>void)(e.target.value)}><option value="">Escolha uma pesquisa</option>{forms.map(f=><option key={f.id} value={f.id}>{f.title} ({f.code})</option>)}</select></label>)}</div>
 {first===second&&first&&<p className="text-sm text-muted-foreground">Escolha duas pesquisas diferentes.</p>}
 {loading&&<p role="status" className="text-sm">Carregando comparação…</p>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {!loading&&left&&right&&<><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">Métrica</th><th className="p-3">Pesquisa A</th><th className="p-3">Pesquisa B</th></tr></thead><tbody><tr className="border-b"><td className="p-3">Respostas</td><td className="p-3">{left.total}</td><td className="p-3">{right.total}</td></tr>{metrics.map(([k,label])=><tr key={k} className="border-b"><td className="p-3">{label}</td><td className="p-3">{value(left,k)} · {pct(value(left,k),left.total)}</td><td className="p-3">{value(right,k)} · {pct(value(right,k),right.total)}</td></tr>)}</tbody></table></div>
 {comparable.length>0?<><label className="block text-sm">Dimensão comparável<select className="ml-2 rounded-lg border bg-background p-2" value={selected} onChange={e=>setCode(e.target.value)}>{comparable.map(x=><option key={x}>{x}</option>)}</select></label><EvidenceChart title={"Comparação: "+selected} rows={rows} series={[{key:"Pesquisa A",label:"Pesquisa A"},{key:"Pesquisa B",label:"Pesquisa B"}]}/><p className="text-xs text-muted-foreground">Contagens, não causalidade. Verifique equivalência de opções e amostra antes de interpretar diferenças.</p></>:<p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Não há perguntas classificadas de maneira equivalente para comparação detalhada. Os novos modelos incluem classificações; pesquisas históricas exigem mapeamento validado.</p>}
 </>}
 </section>;
}
