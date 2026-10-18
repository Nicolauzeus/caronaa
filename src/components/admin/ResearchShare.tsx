import {useEffect,useState} from "react";
import QRCode from "qrcode";
export function ResearchShare({title,url}:{title:string;url:string}){
 const [qr,setQr]=useState("");
 const [copied,setCopied]=useState(false);
 useEffect(()=>{let active=true;void QRCode.toDataURL(url,{width:320,margin:2,errorCorrectionLevel:"M"}).then(value=>{if(active)setQr(value)}).catch(()=>{if(active)setQr("")});return()=>{active=false}},[url]);
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setCopied(false)}};
 return <section className="space-y-3 rounded-xl border bg-card p-4">
  <h3 className="font-bold">Compartilhar pesquisa</h3>
  <p className="break-all text-xs text-muted-foreground">{url}</p>
  <div className="flex flex-wrap items-center gap-4">
   {qr&&<img src={qr} alt={"QR Code da pesquisa "+title} className="h-32 w-32 rounded-lg border bg-white p-2"/>}
   <div className="flex flex-col gap-2">
    <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={()=>void copy()}>{copied?"Link copiado":"Copiar link"}</button>
    <a target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-center text-sm" href={"https://wa.me/?text="+encodeURIComponent("Participe da pesquisa "+title+" — "+url)}>Compartilhar no WhatsApp</a>
    {qr&&<a download={"caronaa-"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".png"} href={qr} className="rounded-lg border px-4 py-2 text-center text-sm">Baixar QR Code</a>}
   </div>
  </div>
 </section>;
}
