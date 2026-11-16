import { describe, expect, it, vi } from "vitest";
import { fetchGoogleWithDeadline, googleTransportFailure, runtimeGoogleFetch } from "../google-http-transport";
import { authenticatedGoogleRequest, type GoogleRequestDependencies } from "../google-request.server";
import { createQuickQuoteCoordinator, quickQuoteItineraryKey } from "./quick-quote-coordinator";
import { quickQuoteGateError } from "./quick-quote-rate-error";

vi.mock("@tanstack/react-start/server",()=>({getRequest:()=>({})}));
const quote=(id="q")=>({quoteId:id,expiresAt:"2099-01-01T00:00:00Z"});
const url="https://routes.googleapis.com/directions/v2:computeRoutes";

describe("Google transport regression",()=>{
  it("reproduces an invalid receiver in the old dependency-object call",async()=>{
    const deps={fetch:async function(this:unknown){
      if(this!==globalThis)throw new TypeError("Illegal invocation");
      return new Response("{}");
    }};
    await expect(deps.fetch()).rejects.toThrow("Illegal invocation");
  });
  it("uses the global receiver and supplies an abort signal",async()=>{
    const fetcher=vi.fn(async function(this:unknown,_url:RequestInfo|URL,init?:RequestInit){
      expect(this).toBe(globalThis);expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("{}");
    });
    expect((await fetchGoogleWithDeadline(fetcher,url,{},100)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("bounds a stalled request even without AbortSignal.timeout",async()=>{
    let signal:AbortSignal|null|undefined;
    const fetcher=vi.fn((_url:RequestInfo|URL,init?:RequestInit)=>{
      signal=init?.signal;return new Promise<Response>(()=>undefined);
    });
    await expect(fetchGoogleWithDeadline(fetcher,url,{},10)).rejects.toMatchObject({name:"TimeoutError"});
    expect(signal?.aborted).toBe(true);
  });
  it("clears the deadline when the request succeeds",async()=>{
    let signal:AbortSignal|null|undefined;
    await fetchGoogleWithDeadline(async(_url,init)=>{signal=init?.signal;return new Response("{}");},url,{},10);
    await new Promise(resolve=>setTimeout(resolve,25));
    expect(signal?.aborted).toBe(false);
  });
  it("preserves the runtime fetch receiver through a dependency object",async()=>{
    const spy=vi.spyOn(globalThis,"fetch").mockImplementation(async function(this:unknown){
      expect(this).toBe(globalThis);return new Response("{}");
    });
    try{expect((await ({fetch:runtimeGoogleFetch}).fetch(url)).ok).toBe(true);}
    finally{spy.mockRestore();}
  });
  it("classifies without returning sensitive exception text",()=>{
    expect(googleTransportFailure(new TypeError("Illegal invocation secret"))).toBe("INVALID_FETCH_RECEIVER");
    expect(googleTransportFailure(Object.assign(new Error(),{cause:{code:"ENOTFOUND"}}))).toBe("DNS_ERROR");
    expect(googleTransportFailure(new Error("https://private?key=secret"))).toBe("NETWORK_ERROR");
  });
  it("uses the fixed transport in the actual authenticated request function",async()=>{
    const deps:GoogleRequestDependencies={
      fetch:vi.fn(async function(this:unknown){expect(this).toBe(globalThis);return new Response("{}");}),
      consume:vi.fn().mockResolvedValue(true),log:vi.fn().mockResolvedValue(undefined),defer:vi.fn(),
    };
    expect((await authenticatedGoogleRequest({url,key:"test-only",userId:"test-user",caller:"test",operation:"quote"},deps)).ok).toBe(true);
    expect(deps.consume).toHaveBeenCalledOnce();
  });
});

describe("quote coordination, without changing server authorization",()=>{
  it("ten concurrent consumers use one real request",async()=>{
    const coordinator=createQuickQuoteCoordinator();
    const load=vi.fn(async()=>quote());
    await Promise.all(Array.from({length:10},()=>coordinator.run("alice","CAR:trip",load)));
    expect(load).toHaveBeenCalledOnce();
  });
  it("keys exact coordinates, not asynchronously resolved labels",()=>{
    const origin={lat:0,lng:0,label:"GPS"};const destination={lat:1,lng:1};
    expect(quickQuoteItineraryKey(origin,destination,"MOTO")).toBe(quickQuoteItineraryKey({...origin,label:"Street name"} as typeof origin,destination,"MOTO"));
    expect(quickQuoteItineraryKey(origin,destination,"CAR")).not.toBe(quickQuoteItineraryKey({...origin,lat:0.000001},destination,"CAR"));
  });
  it("reuses a valid quote after remount and separates categories",async()=>{
    const c=createQuickQuoteCoordinator();const load=vi.fn(async()=>quote());
    await c.run("alice","CAR",load);await c.run("alice","MOTO",load);await c.run("alice","CAR",load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not share quotes between accounts or after logout",async()=>{
    const c=createQuickQuoteCoordinator();const load=vi.fn(async()=>quote());
    await c.run("alice","trip",load);await c.run("bob","trip",load);c.setAccount(null);await c.run("bob","trip",load);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("never caches an expired or consumed quote for reuse",async()=>{
    let now=1000;const c=createQuickQuoteCoordinator(()=>now);
    const load=vi.fn(async()=>({quoteId:"q",expiresAt:new Date(now+10000).toISOString()}));
    await c.run("alice","trip",load);now+=6000;await c.run("alice","trip",load);c.forget("q");await c.run("alice","trip",load);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("allows explicit recovery after a network failure",async()=>{
    const c=createQuickQuoteCoordinator();const load=vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(quote());
    await expect(c.run("alice","trip",load)).rejects.toThrow("network");
    expect((await c.run("alice","trip",load)).quoteId).toBe("q");expect(load).toHaveBeenCalledTimes(2);
  });
  it("blocks retries during real rate exhaustion but keeps the other valid price",async()=>{
    let now=1000;const c=createQuickQuoteCoordinator(()=>now);const good=vi.fn(async()=>quote("MOTO"));
    await c.run("alice","MOTO",good);
    await expect(c.run("alice","CAR",async()=>{throw new Error("F07_QUOTE_RATE_LIMIT");})).rejects.toThrow();
    const retry=vi.fn(async()=>quote("CAR"));
    await expect(c.run("alice","CAR",retry)).rejects.toThrow("F07_QUOTE_RATE_LIMIT");
    expect(retry).not.toHaveBeenCalled();expect(c.remainingMs()).toBe(60000);
    expect((await c.run("alice","MOTO",good)).quoteId).toBe("MOTO");expect(good).toHaveBeenCalledOnce();
    now+=60001;await c.run("alice","CAR",retry);expect(retry).toHaveBeenCalledOnce();
  });
  it("ignores a late old-account response when populating the new account cache",async()=>{
    const c=createQuickQuoteCoordinator();let resolve!:(value:ReturnType<typeof quote>)=>void;
    const old=c.run("alice","trip",()=>new Promise<ReturnType<typeof quote>>(r=>{resolve=r;}));
    await Promise.resolve();await c.run("bob","trip",async()=>quote("bob"));resolve(quote("alice"));await old;
    expect((await c.run("bob","trip",async()=>quote("wrong"))).quoteId).toBe("bob");
  });
  it("does not misreport schema/auth failures as an exhausted allowance",()=>{
    for(const code of ["42501","42883","42703","PGRST202"])
      expect(quickQuoteGateError({code,message:"missing RPC"},null)?.message).not.toContain("F07_QUOTE_RATE_LIMIT");
    expect(quickQuoteGateError(null,true)).toBeNull();
    expect(quickQuoteGateError(null,false)?.message).toContain("F07_QUOTE_RATE_LIMIT");
    expect(quickQuoteGateError({code:"P0001",message:"Limite temporário de cotações atingido"},null)?.message).toContain("F07_QUOTE_RATE_LIMIT");
  });
});
