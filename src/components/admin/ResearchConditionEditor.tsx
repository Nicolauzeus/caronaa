import type { ResearchCondition, ResearchConditionGroup } from "@/lib/formulario/research-conditions";
import type { SurveyQuestion } from "@/lib/formulario/research-templates";

const input = "min-h-10 w-full min-w-0 rounded-lg border bg-background px-2.5 py-2 text-xs sm:text-sm";
function choiceOptions(q: SurveyQuestion | undefined) {
  if (!q) return [];
  if (q.type === "yes_no") return ["SIM", "NAO"];
  if (["single_choice", "multiple_choice", "money_range"].includes(q.type)) return q.options;
  return [];
}
function defaultRule(parents: SurveyQuestion[]): ResearchCondition {
  const question = parents[0];
  return {questionId: question?.id ?? "", comparison: "EQ", value: choiceOptions(question)[0] ?? ""};
}
function ConditionItem({node,parents,onChange,onRemove,depth}:{
  node: ResearchCondition; parents: SurveyQuestion[];
  onChange:(next:ResearchCondition)=>void; onRemove:()=>void; depth:number;
}) {
  if ("rules" in node) return (
    <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Condição composta</span>
        <select aria-label="Combinação das condições" value={node.op} disabled={false}
          onChange={e=>onChange({...node,op:e.target.value as "ALL"|"ANY"})}
          className={input+" ml-auto max-w-32"}>
          <option value="ALL">Todas (E)</option>
          <option value="ANY">Qualquer (OU)</option>
        </select>
        <button type="button" onClick={onRemove} className="rounded-lg border px-2 py-2 text-xs">Remover</button>
      </div>
      {node.rules.map((rule,index)=>(
        <ConditionItem key={index} node={rule} parents={parents} depth={depth+1}
          onChange={next=>onChange({...node,rules:node.rules.map((r,i)=>i===index?next:r)})}
          onRemove={()=>onChange({...node,rules:node.rules.filter((_,i)=>i!==index)})}/>
      ))}
      {node.rules.length<10&&(
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border px-3 py-2 text-xs"
            onClick={()=>onChange({...node,rules:[...node.rules,defaultRule(parents)]})}>+ Regra</button>
          {depth<5&&<button type="button" className="rounded-lg border px-3 py-2 text-xs"
            onClick={()=>onChange({...node,rules:[...node.rules,{op:"ALL",rules:[defaultRule(parents)]}]})}>
            + Grupo E/OU
          </button>}
        </div>
      )}
    </div>
  );
  const parent=parents.find(q=>q.id===node.questionId);
  const choices=choiceOptions(parent);
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,.65fr)_minmax(0,1fr)_auto]">
      <select aria-label="Pergunta que controla a condição" className={input} value={node.questionId}
        onChange={e=>{
          const q=parents.find(p=>p.id===e.target.value);
          onChange({questionId:e.target.value,comparison:"EQ",value:choiceOptions(q)[0]??""});
        }}>
        {parents.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <select aria-label="Comparação" className={input} value={node.comparison}
        onChange={e=>{
          const comparison=e.target.value as typeof node.comparison;
          onChange({...node,comparison,value:comparison==="ANSWERED"?undefined:choices[0]??""});
        }}>
        <option value="EQ">É igual a</option>
        <option value="NEQ">É diferente de</option>
        {parent?.type==="multiple_choice"&&<option value="INCLUDES">Contém</option>}
        <option value="ANSWERED">Está preenchida</option>
      </select>
      {node.comparison!=="ANSWERED"?
        <select aria-label="Resposta da condição" className={input} value={node.value??""}
          onChange={e=>onChange({...node,value:e.target.value})}>
          {choices.map(v=><option key={v} value={v}>{v}</option>)}
        </select>:<span className="self-center text-xs text-muted-foreground">Qualquer resposta</span>}
      <button type="button" onClick={onRemove} className="rounded-lg border px-2 py-2 text-xs" aria-label="Remover condição">✕</button>
    </div>
  );
}
export function ResearchConditionEditor({label,value,onChange,parents,disabled}:{
 label:string;value?:ResearchCondition;onChange:(next:ResearchCondition|undefined)=>void;
 parents:SurveyQuestion[]; disabled?:boolean;
}) {
 return (
   <details className="rounded-lg border border-border/70 bg-muted/10 p-3 text-xs">
     <summary className="cursor-pointer font-medium">{label}{value?" · ativa":""}</summary>
     <div className="mt-3 space-y-2">
       <p className="text-xs text-muted-foreground">
         Mostre apenas quando a resposta anterior corresponder. Combine condições com E/OU; grupos podem conter outros grupos.
       </p>
       {!parents.length?<p className="text-xs text-muted-foreground">Crie uma pergunta anterior para configurar regras.</p>:
         value?
           <ConditionItem node={value} parents={parents} depth={0} onChange={onChange} onRemove={()=>onChange(undefined)}/>:
           <button type="button" disabled={disabled} onClick={()=>onChange({op:"ALL",rules:[defaultRule(parents)]})}
             className="rounded-lg border border-primary/40 px-3 py-2 font-semibold">+ Adicionar condição</button>
       }
     </div>
   </details>
 );
}
