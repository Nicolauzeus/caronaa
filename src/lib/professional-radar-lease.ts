/**
 * Best-effort cross-tab coordination for expensive civic verification.
 * Per-component single-flight + SQL rate gates remain authoritative:
 * localStorage itself is NOT a transactional lock.
 */
const LEASE_MS=30000;
export function tryAcquireProfessionalRadarLease(userId:string):(()=>void)|null{
  if(typeof window==="undefined"||!userId)return()=>undefined;
  const key="caronaa:professional-radar-publish:"+userId;
  const now=Date.now();
  const token=String(now)+":"+Math.random().toString(36).slice(2);
  try{
    const prior=window.localStorage.getItem(key);
    if(prior){
      const data=JSON.parse(prior) as {token?:string;until?:number};
      if(Number.isFinite(data.until)&&Number(data.until)>now)return null;
    }
    window.localStorage.setItem(key,JSON.stringify({token,until:now+LEASE_MS}));
    const acquired=JSON.parse(window.localStorage.getItem(key)||"{}") as {token?:string};
    if(acquired.token!==token)return null;
    return ()=>{
      try{
        const current=JSON.parse(window.localStorage.getItem(key)||"{}") as {token?:string};
        if(current.token===token)window.localStorage.removeItem(key);
      }catch{/* storage may be unavailable */}
    };
  }catch{
    // Browsers may block storage. Do not block GPS; SQL throttling is the
    // authoritative concurrency/rate guard.
    return ()=>undefined;
  }
}
