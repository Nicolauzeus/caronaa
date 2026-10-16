import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
type Entry={versionId:string;questionId:string;answer:string;count:number};
type Summary={total:number;versions:{id:string;total:number}[];distributions:Entry[]};
type Question={id:string;label:string;type:string;versionId:string;versionNumber:number};
export function ResearchAnswerInsights({formId}:{formId:string}){
 const [data,setData]=useState<Summary|null>(null),[questions,setQuestions]=useState<Question[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let mounted=true;setLoading(true);void Promise.all([
 (supabase as any).rpc("get_research_answer_summary",{p_form_id:formId}),
 (supabase as any).from("research_form_versions").select("id,version_number,schema_json").eq("form_id",formId).not("published_at","is",null)
 ]).then(([r,v]:any[])=>{if(!mounted)return;if(r.error)setError(r.error.message);else setData(r.data);if(v.data){
  const flat:Question[]=[];
  for(const ver of v.data as any[]){
   for(const sec of ver.schema_json?.sections??[]){
    for(const q of sec.questions??[])flat.push({...q,versionId:ver.id,versionNumber:ver.version_number});
   }
  }
  setQuestions(flat);
 }
 setLoading(false)});return()=>{mounted=false}},[formId]);
 const groups=useMemo(()=>{const map=new Map<string,Entry[]>();for(const e of data?.distributions??[])map.set(e.versionId+":"+e.questionId,[...(map.get(e.versionId+":"+e.questionId)??[]),e]);return [...map].map(([key,entries])=>({key,label:"v"+(questions.find(q=>q.versionId===entries[0].versionId&&q.id===entries[0].questionId)?.versionNumber??"?")+" · "+(questions.find(q=>q.versionId===entries[0].versionId&&q.id===entries[0].questionId)?.label??entries[0].questionId),versionId:entries[0].versionId,entries:entries.sort((a,b)=>b.count-a.count)}))},[data,questions]);
 return <section className="space-y-4 rounded-xl border p-4">
 <h3 className="text-lg font-bold">Resultados deste questionário</h3>
 {loading?<p className="text-sm" role="status">Calculando respostas...</p>:error?<p className="text-destructive" role="alert">{error}</p>:<>
 <div className="rounded-lg bg-secondary/30 p-4"><p className="text-xs text-muted-foreground">Respostas recebidas</p><strong className="text-3xl">{data?.total??0}</strong></div>
 <div className="grid gap-4 lg:grid-cols-2">{groups.map(g=><article key={g.key} className="space-y-3 rounded-lg border p-4"><h4 className="font-semibold">{g.label}</h4>
 {g.entries.map(e=><div key={e.answer} className="text-sm"><div className="flex justify-between gap-2"><span className="break-all">{e.answer}</span><strong>{e.count}</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:((data?.versions?.find(v=>v.id===g.versionId)?.total??0)>0?Math.min(100,e.count/(data?.versions?.find(v=>v.id===g.versionId)?.total??1)*100):0)+"%"}}/></div></div>)}</article>)}</div>
 {!groups.length&&<p className="text-sm text-muted-foreground">Ainda não há respostas para analisar.</p>}
 <p className="text-xs text-muted-foreground">Perguntas de múltipla escolha podem somar mais de 100%. Respostas de texto livre permanecem agrupadas por valor; evite compartilhar dados pessoais em gráficos.</p>
 </>}
 </section>
}
