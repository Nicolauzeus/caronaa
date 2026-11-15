import { useCallback, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { ChevronUp } from "lucide-react";

export type SheetSnap = "peek" | "half" | "full";
type Props={children:ReactNode;value?:SheetSnap;onChange?:(snap:SheetSnap)=>void;title?:string;headerAction?:ReactNode};
// A percentage fallback is understood by jsdom/older browsers; dynamic viewport
// units remain the final CSS value in supported mobile browsers.
const heights:Record<SheetSnap,{fallback:string;dynamic:string}>={
  peek:{fallback:"15%",dynamic:"15dvh"},
  half:{fallback:"50%",dynamic:"50dvh"},
  full:{fallback:"85%",dynamic:"85dvh"},
};
const order:SheetSnap[]=["peek","half","full"];
export function InteractiveBottomSheet({children,value,onChange,title="Planejar viagem",headerAction}:Props){
  const [internal,setInternal]=useState<SheetSnap>("peek");
  const snap=value??internal;
  const start=useRef<{y:number;id:number}|null>(null);
  const change=useCallback((next:SheetSnap)=>{if(value===undefined)setInternal(next);onChange?.(next);},[value,onChange]);
  const down=(event:PointerEvent<HTMLButtonElement>)=>{
    if(event.pointerType==="mouse" && event.button!==0)return;
    start.current={y:event.clientY,id:event.pointerId};
    if(typeof event.currentTarget.setPointerCapture==="function")
      event.currentTarget.setPointerCapture(event.pointerId);
  };
  const up=(event:PointerEvent<HTMLButtonElement>)=>{
    if(start.current?.id!==event.pointerId)return;
    const delta=event.clientY-start.current.y;
    start.current=null;
    if(Math.abs(delta)<32){change(snap==="peek"?"half":snap==="half"?"full":"peek");return;}
    const index=order.indexOf(snap);
    change(order[Math.min(2,Math.max(0,index+(delta<0?1:-1)))]);
  };
  return <section aria-label={title}
    className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#FFBB00]/30 bg-[#121212]/95 text-white shadow-2xl backdrop-blur-xl transition-[height] duration-300 ease-out"
    style={{height:heights[snap].dynamic, minHeight:heights[snap].fallback,
      fontFamily:"Manrope, sans-serif",paddingBottom:"env(safe-area-inset-bottom)"}}>
    <button type="button" aria-label="Alça do painel: toque ou arraste para expandir ou recolher"
      aria-expanded={snap!=="peek"}
      onPointerDown={down} onPointerUp={up} onPointerCancel={()=>{start.current=null;}}
      onKeyDown={e=>{if(e.key==="ArrowUp"){e.preventDefault();change(order[Math.min(2,order.indexOf(snap)+1)]);}
        if(e.key==="ArrowDown"){e.preventDefault();change(order[Math.max(0,order.indexOf(snap)-1)]);}}}
      className="flex min-h-[44px] shrink-0 touch-none items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]">
      <span className="h-1.5 w-12 rounded-full bg-[#FFBB00]/75"/>
      <ChevronUp size={15} className={snap==="full"?"rotate-180":""}/>
    </button>
    {headerAction&&<div className="absolute right-2 top-0 z-10 flex min-h-8 items-center">{headerAction}</div>}
    <div className={"min-h-0 flex-1 overflow-y-auto overscroll-contain "+(snap==="peek"?"px-2 pb-1":"px-4 pb-4")}>{children}</div>
  </section>;
}
