import { useCallback, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import "./interactive-bottom-sheet.css";

export type SheetSnap = "peek" | "half" | "full";
type Props={children:ReactNode;value?:SheetSnap;onChange?:(snap:SheetSnap)=>void;title?:string;headerAction?:ReactNode;rideActive?:boolean};
// A percentage fallback is understood by jsdom/older browsers; dynamic viewport
// units remain the final CSS value in supported mobile browsers.
const heights:Record<SheetSnap,{fallback:string;dynamic:string}>={
  peek:{fallback:"224px",dynamic:"0px"},
  half:{fallback:"68%",dynamic:"0px"},
  full:{fallback:"92%",dynamic:"0px"},
};
const order:SheetSnap[]=["peek","half","full"];
export function InteractiveBottomSheet({children,value,onChange,title="Planejar viagem",headerAction,rideActive=false}:Props){
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
  return <section aria-label={title} data-ride-active={rideActive?"true":"false"} data-snap={snap}
    className="caronaa-journey-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-primary/20 bg-secondary/95 text-secondary-foreground shadow-[0_-12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-[height] duration-200 ease-out motion-reduce:transition-none"
    style={{height:heights[snap].fallback, minHeight:heights[snap].dynamic,
      maxHeight:"calc(100% - 70px)"}}>
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-caronaa-white/10">
    <Button variant="ghost" type="button" aria-label="Alça do painel: toque ou arraste para expandir ou recolher"
      aria-expanded={snap!=="peek"}
      onPointerDown={down} onPointerUp={up} onPointerCancel={()=>{start.current=null;}}
      onKeyDown={e=>{if(e.key==="ArrowUp"){e.preventDefault();change(order[Math.min(2,order.indexOf(snap)+1)]);}
        if(e.key==="ArrowDown"){e.preventDefault();change(order[Math.max(0,order.indexOf(snap)-1)]);}}}
      className="caronaa-journey-sheet__handle h-10 min-w-0 touch-none text-primary">
      <span className="h-1.5 w-12 rounded-full bg-primary/60"/>
      <ChevronUp size={15} className={snap==="full"?"rotate-180":""}/>
    </Button>
    {headerAction&&<div className="flex min-h-11 shrink-0 items-center pr-2">{headerAction}</div>}
    </div>
    <div className={"caronaa-journey-sheet__content min-h-0 flex-1 overflow-y-auto overscroll-contain "+(snap==="peek"?"px-3 pb-2":"px-4 pb-4")}><div className="h-full min-h-0">{children}</div></div>
  </section>;
}
