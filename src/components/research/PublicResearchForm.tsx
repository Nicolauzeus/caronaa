import {useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import type {SurveySchema} from "@/lib/formulario/research-templates";
import {cleanAnswers,validatePage,type Answers} from "@/lib/formulario/research-schema";
import {ResearchBrandHeader,ResearchSectionFields} from "@/components/research/ResearchFields";
type Form={id:string;version:string;title:string;schema:SurveySchema;brandImagePath:string|null;brandAlt:string|null;brandName:string|null};
export function PublicResearchForm({code}:{code:string}){
 const [form,setForm]=useState<Form|null>(null),[answers,setAnswers]=useState<Answers>({}),[submissionKey]=useState(()=>crypto.randomUUID());
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[complete,setComplete]=useState(false),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[step,setStep]=useState(0);
 useEffect(()=>{let alive=true;void (async()=>{
  const {data:f,error:fe}=await (supabase as any).from("research_forms").select("id,title,brand_image_path,brand_image_alt,brand_display_name").ilike("code",code).eq("status","PUBLICADO").eq("is_enabled",true).maybeSingle();
  if(!alive)return;
  if(fe||!f){setError(fe?"Não foi possível carregar a pesquisa. Tente novamente.":"Esta pesquisa não está disponível para novas respostas.");setLoading(false);return}
  const {data:v,error:ve}=await (supabase as any).from("research_form_versions").select("id,schema_json").eq("form_id",f.id).not("published_at","is",null).order("version_number",{ascending:false}).limit(1).maybeSingle();
  if(!alive)return;
  if(ve||!v||!Array.isArray(v.schema_json?.sections)||!v.schema_json.sections.length){setError("Questionário indisponível. Entre em contato com o organizador.");setLoading(false);return}
  setForm({id:f.id,version:v.id,title:f.title,schema:v.schema_json,brandImagePath:f.brand_image_path,brandAlt:f.brand_image_alt,brandName:f.brand_display_name});setLoading(false);
 })();return()=>{alive=false}},[code]);
 function next(){if(!form)return;const problems=validatePage(form.schema.sections[step],answers);if(problems.length){setError(problems[0]);return}setError("");setStep(s=>Math.min(form.schema.sections.length-1,s+1))}
 async function submit(e:FormEvent){e.preventDefault();if(!form||busy)return;if(step<form.schema.sections.length-1){next();return;}
 const problems=form.schema.sections.flatMap(section=>validatePage(section,answers));
 if(problems.length){setError(problems[0]);return}
 if(!consent){setError("Leia e confirme o consentimento antes de enviar.");return}
 setBusy(true);setError("");
 const {error:insertError}=await (supabase as any).from("research_answers").insert({form_id:form.id,version_id:form.version,answers:cleanAnswers(form.schema,answers),consent_accepted:true,client_submission_key:submissionKey});
 if(insertError&&insertError.code!=="23505")setError("Não foi possível enviar sua resposta. Verifique a conexão e tente novamente.");
 else setComplete(true);
 setBusy(false);
 }
 if(loading)return <main className="mx-auto max-w-xl p-6" role="status">Carregando pesquisa…</main>;
 if(!form)return <main className="mx-auto max-w-xl space-y-3 p-6" role="alert"><h1 className="text-2xl font-bold">Formulário indisponível</h1><p>{error}</p><button type="button" onClick={()=>window.location.reload()} className="rounded-lg border px-4 py-2">Tentar novamente</button><p className="text-sm text-muted-foreground">Não é necessário cadastro para responder.</p></main>;
 if(complete)return <main className="mx-auto max-w-xl space-y-4 p-6"><ResearchBrandHeader title={form.title} imagePath={form.brandImagePath} alt={form.brandAlt} brandName={form.brandName}/><div className="rounded-xl border bg-card p-5"><h2 className="text-xl font-bold">Resposta registrada!</h2><p className="mt-2 text-sm text-muted-foreground">Sua participação foi concluída mesmo sem criar uma conta.</p></div><div className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-lg font-bold">Quer conhecer o CARONAA?</h2><p className="text-sm text-muted-foreground">Criar uma conta é opcional e independente do consentimento da pesquisa.</p><a className="block rounded-lg bg-primary px-4 py-3 text-center font-semibold text-primary-foreground" href={"/auth?mode=cadastro&redirect="+encodeURIComponent("/home")}>Criar minha conta</a><a className="block text-center text-sm text-muted-foreground" href="/home">Conhecer o aplicativo</a></div></main>;
 const section=form.schema.sections[step],last=step===form.schema.sections.length-1;
 return <main className="mx-auto max-w-xl space-y-5 p-4 py-8 sm:p-8"><ResearchBrandHeader title={form.title} imagePath={form.brandImagePath} alt={form.brandAlt} brandName={form.brandName}/>
 <div className="space-y-2" aria-label="Progresso da pesquisa"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Etapa {step+1} de {form.schema.sections.length}</span><span>{Math.round((step+1)/form.schema.sections.length*100)}% do questionário</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:(step+1)/form.schema.sections.length*100+"%"}}/></div></div>
 <form onSubmit={submit} className="space-y-4"><section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-bold">{section.title}</h2>{section.description&&<p className="text-sm text-muted-foreground">{section.description}</p>}<ResearchSectionFields section={section} answers={answers} onChange={(id,value)=>{setAnswers(a=>({...a,[id]:value}));setError("")}}/></section>
 {last&&<label className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>Concordo em participar desta pesquisa e autorizo o uso das respostas para análise de mobilidade, conforme o aviso de privacidade aplicável. Esse consentimento não autoriza automaticamente contatos comerciais.</span></label>}
 {error&&<p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive" role="alert">{error}</p>}
 <div className="flex items-center justify-between gap-3"><button type="button" disabled={step===0||busy} onClick={()=>{setError("");setStep(s=>s-1)}} className="rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-40">Anterior</button>
 {last?<button type="submit" disabled={busy||!consent} className="rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">{busy?"Enviando…":"Enviar respostas"}</button>:<button type="button" onClick={next} className="rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground">Próxima etapa →</button>}</div></form>
 </main>;
}
