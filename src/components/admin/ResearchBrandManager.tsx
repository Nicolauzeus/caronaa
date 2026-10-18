import {useEffect,useRef,useState,type ChangeEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {RESEARCH_BRAND_IMAGE_TYPES,validateResearchBrandImage} from "@/lib/formulario/research-branding";

export type ResearchBrandForm={
 id:string;title:string;brand_image_path?:string|null;brand_image_alt?:string|null;brand_display_name?:string|null;
};
const BUCKET="research-branding";

export function researchBrandUrl(path?:string|null){
 return path?supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl:null;
}

/** Independent from the form version: branding can be changed on drafts and published forms. */
export function ResearchBrandManager({form,onSaved}:{form:ResearchBrandForm;onSaved?:(next:ResearchBrandForm)=>void}){
 const [path,setPath]=useState<string|null>(form.brand_image_path??null);
 const [name,setName]=useState(form.brand_display_name??"");
 const [alt,setAlt]=useState(form.brand_image_alt??"");
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [saving,setSaving]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  setPath(form.brand_image_path??null);setName(form.brand_display_name??"");setAlt(form.brand_image_alt??"");
  setFile(null);
 },[form.id,form.brand_image_path,form.brand_display_name,form.brand_image_alt]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 const imageUrl=preview??researchBrandUrl(path);
 const dirty=Boolean(file)||path!==(form.brand_image_path??null)||name!==(form.brand_display_name??"")||alt!==(form.brand_image_alt??"");
 function chooseImage(event:ChangeEvent<HTMLInputElement>){
  const next=event.target.files?.[0];event.target.value="";
  if(!next)return;
  setSuccess("");setError("");
  const validationError=validateResearchBrandImage(next.type,next.size);
  if(validationError){
   setError(validationError);
   return;
  }
  setFile(next);setPath(null);setPreview(URL.createObjectURL(next));
  if(!alt.trim())setAlt("Imagem de identidade visual da pesquisa "+form.title);
 }
 function removeImage(){
  setFile(null);setPreview(null);setPath(null);setSuccess("");setError("");
 }
 async function save(){
  if(!dirty||saving)return;
  setSaving(true);setError("");setSuccess("");
  let uploadedPath:string|null=null;
  try{
   if(file){
    const ext=RESEARCH_BRAND_IMAGE_TYPES[file.type];
    const validationError=validateResearchBrandImage(file.type,file.size);
    if(validationError)throw Error(validationError);
    uploadedPath=form.id+"/"+crypto.randomUUID()+"."+ext;
    const {error:uploadError}=await supabase.storage.from(BUCKET).upload(uploadedPath,file,{contentType:file.type,upsert:false,cacheControl:"3600"});
    if(uploadError)throw Error("Falha ao enviar a imagem: "+uploadError.message);
   }
   const nextPath=uploadedPath??path;
   const payload={
    brand_image_path:nextPath,
    brand_image_alt:nextPath?(alt.trim()||"Identidade visual da pesquisa "+form.title):null,
    brand_display_name:name.trim()||null
   };
   const {data,error:updateError}=await (supabase as any).from("research_forms")
    .update(payload).eq("id",form.id).select("id,brand_image_path,brand_image_alt,brand_display_name").maybeSingle();
   if(updateError||!data)throw Error(updateError?.message??"A identidade não foi gravada. Confira suas permissões.");
   setPath(data.brand_image_path??null);setAlt(data.brand_image_alt??"");setName(data.brand_display_name??"");
   setFile(null);setPreview(null);setSuccess("Identidade visual salva. A imagem já pode aparecer no formulário público.");
   onSaved?.({...form,...data});
   const previousPath=form.brand_image_path??null;
   if(previousPath&&previousPath!==nextPath){
    // Clean up the replaced public asset only after the database points to the new one.
    void supabase.storage.from(BUCKET).remove([previousPath]);
   }
  }catch(caught){
   if(uploadedPath)await supabase.storage.from(BUCKET).remove([uploadedPath]);
   setError(caught instanceof Error?caught.message:"Não foi possível salvar a imagem.");
  }finally{setSaving(false)}
 }
 return <section id="research-brand-settings" aria-label="Personalizar imagem da pesquisa" className="space-y-4 rounded-xl border border-border/70 bg-card p-4 sm:p-5">
  <div><h3 className="text-base font-bold">Imagem e identidade da pesquisa</h3><p className="mt-1 text-sm text-muted-foreground">Personalize o ícone do formulário com uma imagem do evento, universidade ou instituição. Funciona também em pesquisas já publicadas.</p></div>
  <div className="flex flex-wrap items-center gap-4">
   <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-2">
    {imageUrl?<img src={imageUrl} alt={alt||"Prévia da imagem selecionada"} className="h-full w-full object-contain"/>:<span aria-hidden="true" className="text-4xl font-black text-[#805900]">C</span>}
   </div>
   <div className="flex flex-col items-start gap-2">
    <button type="button" onClick={()=>fileRef.current?.click()} disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
     {imageUrl?"Trocar imagem":"Adicionar imagem ou logomarca"}
    </button>
    {(imageUrl||file)&&<button type="button" disabled={saving} onClick={removeImage} className="text-sm font-medium text-destructive hover:underline">Remover imagem</button>}
    <p className="text-xs text-muted-foreground">PNG, JPG ou WebP · máximo 2 MB · preferencialmente quadrada</p>
   </div>
   <input ref={fileRef} aria-label="Selecionar imagem do formulário" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={chooseImage}/>
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="text-sm font-medium">Nome exibido sobre o formulário
    <input maxLength={120} value={name} onChange={event=>{setName(event.target.value);setSuccess("")}} placeholder="Ex.: Mobilidade na UNILAB" className="mt-1 w-full rounded-lg border bg-background p-3 font-normal"/>
   </label>
   <label className="text-sm font-medium">Descrição acessível da imagem
    <input maxLength={180} value={alt} onChange={event=>{setAlt(event.target.value);setSuccess("")}} placeholder="Ex.: Identidade visual do evento" className="mt-1 w-full rounded-lg border bg-background p-3 font-normal"/>
   </label>
  </div>
  {dirty&&<p className="text-xs text-amber-700 dark:text-amber-400">Há alterações não salvas na identidade visual.</p>}
  {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
  {success&&<p role="status" className="rounded-lg border border-emerald-600/30 p-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}
  <div className="flex flex-wrap items-center gap-3">
   <button type="button" disabled={saving||!dirty} onClick={()=>void save()} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving?"Salvando imagem…":"Salvar identidade visual"}</button>
   <p className="text-xs text-muted-foreground">Use imagens e logomarcas institucionais somente com autorização. O arquivo será público.</p>
  </div>
 </section>;
}
