import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import type { GoogleUsageReport } from "./OperationsGoogleMapsUsage";

export type PdfReportData = {
  from:string;to:string;service:"all"|"flash"|"shared";generatedAt:string;
  summary:{
    orders:number;accepted:number;unaccepted:number;completed:number;cancelled:number;
    expired:number;searching:number;in_progress:number;unique_passengers:number;
    cancelled_without_acceptance:number;cancelled_after_acceptance:number;
    completed_fares_cents:number;
  };
  hours:Array<{hour:number;orders:number}>;
  hour_days:Array<{weekday:number;hour:number;orders:number}>;
  google_usage?:GoogleUsageReport;
};
const BLACK="#121212", YELLOW="#FFBB00", GREY="#657181";
const serviceNames={all:"Todos os servicos",flash:"Corrida Rapida",shared:"Caronas compartilhadas"};
const num=(n:number)=>n.toLocaleString("pt-BR");
const money=(n:number)=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const weekdays=["SEG","TER","QUA","QUI","SEX","SAB","DOM"];

async function getLogo():Promise<HTMLImageElement|null>{
  return await new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=logoAsset.url;
    if(img.complete&&img.naturalWidth>0)resolve(img);
  });
}
function createCanvas(){
  const canvas=document.createElement("canvas");
  canvas.width=1584;canvas.height=1120; // A4 landscape, high resolution
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Nao foi possivel preparar o documento PDF");
  ctx.fillStyle="#FFFFFF";ctx.fillRect(0,0,canvas.width,canvas.height);
  return {canvas,ctx};
}
function text(ctx:CanvasRenderingContext2D,str:string,x:number,y:number,size=20,color=BLACK,bold=false){
  ctx.fillStyle=color;ctx.font=(bold?"700 ":"400 ")+size+"px Arial, sans-serif";
  ctx.fillText(str,x,y);
}
function rect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){
  ctx.fillStyle=color;ctx.fillRect(x,y,w,h);
}
function head(ctx:CanvasRenderingContext2D,logo:HTMLImageElement|null,d:PdfReportData,subtitle:string){
  if(logo){
    const maxW=250,maxH=105,scale=Math.min(maxW/logo.naturalWidth,maxH/logo.naturalHeight);
    ctx.drawImage(logo,65,38,logo.naturalWidth*scale,logo.naturalHeight*scale);
  }else text(ctx,"CARONAA",65,101,44,YELLOW,true);
  ctx.textAlign="right";
  text(ctx,"RELATORIO DE MOBILIDADE",1518,65,25,BLACK,true);
  text(ctx,serviceNames[d.service]+"  |  "+d.from.split("-").reverse().join("/")+" a "+d.to.split("-").reverse().join("/"),1518,104,18,GREY);
  ctx.textAlign="left";rect(ctx,65,151,1454,5,YELLOW);
  text(ctx,subtitle,65,195,25,BLACK,true);
}
function footer(ctx:CanvasRenderingContext2D,index:number){
  rect(ctx,65,1054,1454,2,"#E5E7EB");
  text(ctx,"CARONAA  |  Operacoes de Mobilidade  |  Horario de Fortaleza",65,1082,14,GREY);
  ctx.textAlign="right";text(ctx,index+" / 2",1518,1082,14,GREY);ctx.textAlign="left";
}
function card(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,title:string,value:string,accent:string,tint:string){
  rect(ctx,x,y,w,h,tint);rect(ctx,x,y,w,5,accent);
  text(ctx,title,x+17,y+41,18,"#444B57");
  text(ctx,value,x+17,y+101,43,BLACK,true);
}
function firstPage(ctx:CanvasRenderingContext2D,d:PdfReportData,logo:HTMLImageElement|null){
  head(ctx,logo,d,"PANORAMA DOS PEDIDOS");
  const s=d.summary;
  const tiles=[
    ["Pedidos feitos",s.orders,YELLOW,"#FFF7E0"],["Aceitos",s.accepted,"#16A34A","#EDFDF4"],
    ["Sem aceite",s.unaccepted,"#E5A100","#FFF9EA"],["Concluidos",s.completed,"#2563EB","#EFF6FF"],
    ["Cancelados",s.cancelled,"#DC2626","#FEF2F2"],["Expirados",s.expired,"#64748B","#F1F5F9"]
  ] as const;
  const tw=234;
  tiles.forEach(([title,value,color,tint],i)=>card(ctx,65+i*246,227,tw,129,title,num(value),color,tint));
  text(ctx,"CONVERSAO E ATENDIMENTO",65,411,24,BLACK,true);
  const accepted=s.orders>0?s.accepted/s.orders:0;
  rect(ctx,65,438,1454,32,YELLOW);rect(ctx,65,438,1454*accepted,32,"#16A34A");
  text(ctx,num(s.accepted)+" aceitos ("+(accepted*100).toFixed(1).replace(".",",")+"%)",65,500,19,BLACK,true);
  ctx.textAlign="right";text(ctx,num(s.unaccepted)+" sem aceite",1518,500,19,BLACK,true);ctx.textAlign="left";
  text(ctx,"Cancelamentos: "+num(s.cancelled_without_acceptance)+" antes e "+num(s.cancelled_after_acceptance)+" apos o aceite.",65,532,17,GREY);
  text(ctx,"INDICADORES COMPLEMENTARES",65,591,24,BLACK,true);
  card(ctx,65,618,345,125,"Passageiros solicitantes",num(s.unique_passengers),"#FFBB00","#FFFBF0");
  card(ctx,435,618,345,125,"Aguardando motorista",num(s.searching),"#F59E0B","#FFF9EB");
  card(ctx,805,618,345,125,"Em atendimento",num(s.in_progress),"#2563EB","#EFF6FF");
  card(ctx,1175,618,344,125,"Tarifas concluidas*",money(s.completed_fares_cents),"#16A34A","#F0FDF4");
  text(ctx,"* Tarifas nao representam valores efetivamente pagos.",65,788,16,GREY);
  text(ctx,"GOOGLE MAPS  |  CONSUMO INTERNO DAS APIS",65,867,23,BLACK,true);
  if(d.google_usage){
    const usage=d.google_usage.summary;
    const values=[
      ["Chamadas registradas",usage.total],
      ["Places API",usage.places],
      ["Routes API",usage.routes],
      ["Erros internos",usage.errors],
    ] as const;
    values.forEach(([title,value],i)=>card(ctx,65+370*i,889,345,116,title,num(value),i===0?YELLOW:"#78909C",i===0?"#FFF9E8":"#F8FAFC"));
  }else{
    text(ctx,"Registros de consumo indisponiveis para o intervalo.",65,928,18,GREY);
  }
  text(ctx,"Chamadas registradas no CARONAA; podem diferir do consumo faturado no Google Cloud.",65,1035,13,GREY);
  footer(ctx,1);
}
function secondPage(ctx:CanvasRenderingContext2D,d:PdfReportData,logo:HTMLImageElement|null){
  head(ctx,logo,d,"HORARIOS DE MAIOR DEMANDA");
  const series=Array.from({length:24},(_,hour)=>d.hours.find(x=>x.hour===hour)?.orders??0);
  const max=Math.max(1,...series);
  const chartY=480,chartH=230,barW=44,gap=16;
  for(let h=0;h<24;h++){
    const n=series[h];const bh=Math.max(3,Math.round(chartH*n/max));const x=80+h*(barW+gap);
    rect(ctx,x,chartY-bh,barW,bh,n===max&&n>0?YELLOW:n>max/2?"#F7D56E":"#FBE9B8");
    text(ctx,String(n),x+8,chartY-bh-9,15,GREY);
    text(ctx,String(h).padStart(2,"0"),x+7,chartY+24,15,GREY);
  }
  text(ctx,"MAPA DE CALOR  |  DIA DA SEMANA X HORA",65,568,23,BLACK,true);
  const map=new Map(d.hour_days.map(x=>[x.weekday+":"+x.hour,x.orders] as const));
  const heatMax=Math.max(1,...d.hour_days.map(x=>x.orders));
  for(let h=0;h<24;h++)text(ctx,String(h).padStart(2,"0"),135+h*57,602,13,GREY);
  for(let day=0;day<7;day++){
    const y=617+day*54;text(ctx,weekdays[day],65,y+28,16,BLACK,true);
    for(let h=0;h<24;h++){
      const n=map.get(day+":"+h)??0,k=n/heatMax;
      const color=n===0?"#F0F1F4":k>.75?YELLOW:k>.45?"#FFD66B":k>.15?"#FFE9A8":"#FFF4D4";
      rect(ctx,130+h*57,y,51,43,color);
    }
  }
  text(ctx,"Cada celula representa pedidos registrados no dia e horario indicados.",65,1026,15,GREY);
  footer(ctx,2);
}
function jpegBytes(canvas:HTMLCanvasElement):Promise<Uint8Array>{
  return new Promise((resolve,reject)=>{
    canvas.toBlob(async blob=>{
      if(!blob){reject(new Error("Falha ao converter a pagina do relatorio"));return;}
      resolve(new Uint8Array(await blob.arrayBuffer()));
    },"image/jpeg",0.93);
  });
}
/** Two-page A4 landscape PDF using embedded canvas JPEG pages, no external SDK. */
function packPdf(jpegs:Uint8Array[],width:number,height:number):Blob{
  const encoder=new TextEncoder();
  const chunks:Uint8Array[]=[];const offsets:number[]=[0];let offset=0;
  const append=(bytes:Uint8Array)=>{chunks.push(bytes);offset+=bytes.length;};
  const ascii=(s:string)=>append(encoder.encode(s));
  ascii("%PDF-1.4\n");
  const begin=(id:number)=>{offsets[id]=offset;ascii(id+" 0 obj\n");};
  const end=()=>ascii("\nendobj\n");
  begin(1);ascii("<< /Type /Catalog /Pages 2 0 R >>");end();
  begin(2);ascii("<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>");end();
  begin(3);ascii("<< /Producer (CARONAA) >>");end();
  for(let i=0;i<jpegs.length;i++){
    const pageId=4+2*i, imageId=5+2*i, streamId=8+i, name="/Img"+i;
    begin(pageId);ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+width+" "+height+"] /Resources << /XObject << "+name+" "+imageId+" 0 R >> >> /Contents "+streamId+" 0 R >>");end();
    const bytes=jpegs[i];begin(imageId);
    ascii("<< /Type /XObject /Subtype /Image /Width 1584 /Height 1120 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+bytes.length+" >>\nstream\n");
    append(bytes);ascii("\nendstream");end();
  }
  for(let i=0;i<jpegs.length;i++){
    begin(8+i);
    const stream="q\n"+width+" 0 0 "+height+" 0 0 cm\n/Img"+i+" Do\nQ\n";
    ascii("<< /Length "+encoder.encode(stream).length+" >>\nstream\n"+stream+"endstream");end();
  }
  const startXref=offset;
  ascii("xref\n0 10\n0000000000 65535 f \n");
  for(let id=1;id<=9;id++)ascii(String(offsets[id]??0).padStart(10,"0")+" 00000 n \n");
  ascii("trailer\n<< /Size 10 /Root 1 0 R /Info 3 0 R >>\nstartxref\n"+startXref+"\n%%EOF");
  return new Blob(chunks as BlobPart[],{type:"application/pdf"});
}
export async function createOperationsReportPdf(data:PdfReportData):Promise<File>{
  if(data.summary.orders<0||!Array.isArray(data.hours)||!Array.isArray(data.hour_days))
    throw new Error("Dados do relatorio invalidos");
  const logo=await getLogo();
  const first=createCanvas();firstPage(first.ctx,data,logo);
  const second=createCanvas();secondPage(second.ctx,data,logo);
  const pages=await Promise.all([jpegBytes(first.canvas),jpegBytes(second.canvas)]);
  const blob=packPdf(pages,842,595);
  return new File([blob],"CARONAA_Relatorio_"+data.from+"_"+data.to+".pdf",{type:"application/pdf"});
}
export function saveOperationsPdf(file:File){
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");a.href=url;a.download=file.name;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
