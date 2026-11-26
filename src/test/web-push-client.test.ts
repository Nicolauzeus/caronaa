import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc}}));
import { subscribeDriverToPush, unsubscribeDriverFromPush, urlBase64ToUint8Array } from "@/lib/push/web-push-client";

const sub={endpoint:"https://push.example/abc",unsubscribe:vi.fn(async()=>true),
  toJSON:()=>({endpoint:"https://push.example/abc",keys:{p256dh:"P",auth:"A"}})};
const pushManager={getSubscription:vi.fn(),subscribe:vi.fn()};
let permission="default";
const requestPermission=vi.fn(async()=>permission);
beforeEach(()=>{
  vi.clearAllMocks();rpc.mockResolvedValue({error:null});
  pushManager.getSubscription.mockResolvedValue(null);pushManager.subscribe.mockResolvedValue(sub);
  Object.defineProperty(window,"isSecureContext",{configurable:true,value:true});
  Object.defineProperty(window,"PushManager",{configurable:true,value:function(){}});
  Object.defineProperty(window,"Notification",{configurable:true,value:{get permission(){return "default";},requestPermission}});
  Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{getRegistration:vi.fn(async()=>({pushManager}))}});
});
afterEach(()=>{permission="default";});

describe("web push client",()=>{
  it("decodes URL-safe base64 VAPID keys",()=>{
    expect(Array.from(urlBase64ToUint8Array("AQID_-8"))).toEqual([1,2,3,255,239]);
  });
  it("subscribes and saves the subscription when permission is granted",async()=>{
    permission="granted";
    expect(await subscribeDriverToPush()).toEqual({ok:true});
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({userVisibleOnly:true}));
    expect(rpc).toHaveBeenCalledWith("save_driver_push_subscription",expect.objectContaining({
      p_endpoint:"https://push.example/abc",p_p256dh:"P",p_auth:"A"}));
  });
  it("does not subscribe when permission is denied",async()=>{
    permission="denied";
    expect(await subscribeDriverToPush()).toEqual({ok:false,reason:"DENIED"});
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports save failure",async()=>{
    permission="granted";rpc.mockResolvedValue({error:{message:"x"}});
    expect(await subscribeDriverToPush()).toEqual({ok:false,reason:"SAVE_FAILED"});
  });
  it("unsubscribes and deletes the saved endpoint",async()=>{
    pushManager.getSubscription.mockResolvedValue(sub);
    await unsubscribeDriverFromPush();
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("delete_driver_push_subscription",{p_endpoint:"https://push.example/abc"});
  });
});
