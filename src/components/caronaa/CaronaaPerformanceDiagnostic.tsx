import { useEffect, useState } from "react";

/** Optional, on-device diagnostics. No user IDs, coordinates, addresses or URLs logged. */
type PerfSample = { phase:string; elapsedMs:number; atMs:number };
const samples:PerfSample[]=[];
const startTimes = new Map<string,number>();
let started=false;
let observer:PerformanceObserver|null=null;
let longTaskCount=0;
let longTaskTotalMs=0;

function eligible():boolean{
  if(typeof window==="undefined")return false;
  try {
    return window.location.hash.includes("diagnostico") ||
      window.sessionStorage.getItem("caronaa_perf_diag")==="1";
  } catch {return false;}
}
export function startCaronaaPerfDiagnostics(){
  if(!eligible()||started || typeof window==="undefined")return;
  started=true;
  try{window.sessionStorage.setItem("caronaa_perf_diag","1");}catch{}
  if(typeof PerformanceObserver!=="undefined"){
    try {
      observer=new PerformanceObserver(list=>{
        for(const entry of list.getEntries()){
          longTaskCount++;
          longTaskTotalMs+=entry.duration;
        }
      });
      observer.observe({entryTypes:["longtask"]});
    }catch {observer?.disconnect();observer=null;}
  }
}
export function beginCaronaaPhase(phase:string){
  if(!eligible())return;
  startCaronaaPerfDiagnostics();
  startTimes.set(phase,performance.now());
}
export function endCaronaaPhase(phase:string){
  if(!eligible())return;
  const start=startTimes.get(phase);
  if(start===undefined)return;
  startTimes.delete(phase);
  samples.push({phase,elapsedMs:Math.round(performance.now()-start),atMs:Math.round(performance.now())});
  if(samples.length>80)samples.shift();
}
export function caronaaPerformanceReport(){
  if(typeof window==="undefined")return "";
  const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
  const paint=performance.getEntriesByType("paint");
  const report={
    version:1,
    measuredOnDevice:true,
    capturedAt:new Date().toISOString(),
    browser:navigator.userAgent.slice(0,180),
    visibility:document.visibilityState,
    navigation:nav?{
      domContentLoadedMs:Math.round(nav.domContentLoadedEventEnd),
      loadMs:Math.round(nav.loadEventEnd),
      responseMs:Math.round(nav.responseEnd-nav.requestStart),
    }:null,
    firstContentfulPaintMs:paint.find(p=>p.name==="first-contentful-paint")?.startTime??null,
    longTasks:{count:longTaskCount,totalDurationMs:Math.round(longTaskTotalMs)},
    completedPhases:[...samples],
    incompletePhases:[...startTimes.keys()],
  };
  return JSON.stringify(report,null,2);
}
export function CaronaaPerformanceDiagnostic(){
  const [enabled,setEnabled]=useState(false);
  const [snapshot,setSnapshot]=useState("");
  useEffect(()=>{
    const sync=()=>{
      const current=eligible();
      setEnabled(current);
      if(current){startCaronaaPerfDiagnostics();setSnapshot(caronaaPerformanceReport());}
    };
    sync();window.addEventListener("hashchange",sync);
    return()=>window.removeEventListener("hashchange",sync);
  },[]);
  if(!enabled)return null;
  return <aside aria-label="Diagnóstico de desempenho" className="fixed bottom-24 right-3 z-[9999] max-h-[45vh] w-[min(90vw,350px)] overflow-auto rounded-xl border border-yellow-500 bg-[#121212] p-3 text-white shadow-xl">
    <p className="text-sm font-bold text-[#FFBB00]">Diagnóstico local de desempenho</p>
    <p className="mt-1 text-xs text-gray-300">Sem envio automático. Copie o relatório somente se quiser compartilhá-lo.</p>
    <div className="mt-2 flex gap-2">
      <button type="button" className="rounded bg-[#FFBB00] px-3 py-2 text-xs font-bold text-black"
        onClick={()=>setSnapshot(caronaaPerformanceReport())}>Atualizar</button>
      <button type="button" className="rounded border border-white/40 px-3 py-2 text-xs"
        onClick={()=>{void navigator.clipboard?.writeText(caronaaPerformanceReport());}}>Copiar relatório</button>
    </div>
    <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-all text-[10px]">{snapshot}</pre>
  </aside>;
}
