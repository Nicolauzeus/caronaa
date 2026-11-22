import { createFileRoute } from "@tanstack/react-router";

/** Server-only protected dispatch. Do not move env variables or service-role imports to client code. */
export const Route = createFileRoute("/api/operations/report-scheduler")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret=process.env["CARONAA_REPORT_SCHEDULER_TOKEN"]??"";
        const emailKey=process.env["RESEND_API_KEY"]??"";
        const sender=process.env["CARONAA_REPORT_FROM"]??"";
        const serviceKey=process.env["SUPABASE_SERVICE_ROLE_KEY"]??"";
        if(secret.length<32||!emailKey||!serviceKey||!/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(sender)) {
          return Response.json({error:"scheduler_not_configured"},{status:503});
        }
        const {timingSafeEqual,createHash}=await import("node:crypto");
        const provided=request.headers.get("authorization")?.replace(/^Bearer /i,"").trim()??"";
        const left=Buffer.from(provided,"utf8"),right=Buffer.from(secret,"utf8");
        if(left.length!==right.length||!timingSafeEqual(left,right)){
          return Response.json({error:"unauthorized"},{status:401});
        }
        const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
        const rpc=(name:string,args?:Record<string,unknown>)=>(supabaseAdmin as any).rpc(name,args);
        const due=await rpc("service_caronaa_report_jobs");
        if(due.error||!Array.isArray(due.data)){
          return Response.json({error:"report_jobs_unavailable"},{status:503});
        }
        let sent=0,failed=0,skipped=0;
        for(const job of due.data.slice(0,3)){
          const cadence=String(job.cadence??"");
          const start=String(job.window_start??"");
          const end=String(job.window_end??"");
          const targets=Array.isArray(job.recipients)?job.recipients.slice(0,10):[];
          if(!["daily","weekly","monthly"].includes(cadence)||
            !/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))continue;
          const summary=await rpc("service_caronaa_report_summary",{p_from:start,p_to:end});
          if(summary.error||!summary.data){failed+=targets.length;continue;}
          const s=summary.data as Record<string,unknown>;
          const num=(name:string)=>Number.isFinite(Number(s[name]))?Math.max(0,Math.trunc(Number(s[name]))):0;
          const displayCadence:{[key:string]:string}={daily:"Diário",weekly:"Semanal",monthly:"Mensal"};
          const subject="CARONAA | Resumo "+displayCadence[cadence]+" | "+start+" a "+end;
          const format=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
          const summaryText=[
            "CARONAA — Resumo operacional",cadence+" | "+start+" a "+end,
            "Pedidos feitos: "+format(num("orders")),
            "Pedidos sem aceite: "+format(num("unaccepted")),
            "Pedidos aceitos: "+format(num("accepted")),
            "Corridas concluídas: "+format(num("completed")),
            "Canceladas: "+format(num("cancelled")),
            "Passageiros que fizeram pedidos: "+format(num("passengers")),
            "Pico de pedidos: "+(s["peak_hour"]===null?"Sem pedidos registrados":num("peak_hour")+"h"),
            "Tarifas de corridas concluídas (não são pagamentos recebidos): "+(num("completed_fares_cents")/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),
            "Veja os relatórios completos no painel administrativo: https://caronaa.com/admin/operacoes#history",
          ].join("\n");
          const summaryHtml="<div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#121212'>"+
            "<div style='background:#FFBB00;padding:22px;border-radius:12px 12px 0 0'>"+
            "<h1 style='margin:0;font-size:22px'>CARONAA · Resumo "+displayCadence[cadence]+"</h1></div>"+
            "<div style='padding:24px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px'>"+
            "<p>Período: <strong>"+start+" a "+end+"</strong> (Fortaleza)</p>"+
            "<p>Pedidos feitos: <strong>"+format(num("orders"))+"</strong></p>"+
            "<p>Sem aceite: <strong>"+format(num("unaccepted"))+"</strong></p>"+
            "<p>Aceitos: <strong>"+format(num("accepted"))+"</strong></p>"+
            "<p>Concluídos: <strong>"+format(num("completed"))+"</strong></p>"+
            "<p>Cancelados: <strong>"+format(num("cancelled"))+"</strong></p>"+
            "<p>Passageiros que pediram: <strong>"+format(num("passengers"))+"</strong></p>"+
            "<p>Horário de pico: <strong>"+(s["peak_hour"]===null?"N/D":num("peak_hour")+"h")+"</strong></p>"+
            "<p>Tarifas de corridas concluídas (não confirma recebimento): <strong>"+(num("completed_fares_cents")/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+"</strong></p>"+
            "<p><a href='https://caronaa.com/admin/operacoes#history' style='color:#121212;font-weight:bold'>Abrir relatórios no CARONAA</a></p>"+
            "<small>Este relatório contém somente dados agregados. Sem GPS, telefones ou dados pessoais.</small></div></div>";
          for(const value of targets){
            const recipient=String(value);
            if(!/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(recipient)){skipped++;continue;}
            const claim=await rpc("service_caronaa_report_claim",{p_cadence:cadence,p_start:start,p_end:end,p_recipient:recipient});
            if(claim.error||claim.data!==true){skipped++;continue;}
            const key="caronaa-"+createHash("sha256").update(cadence+"|"+start+"|"+end+"|"+recipient).digest("hex").slice(0,48);
            let success=false,errorCode="EMAIL_PROVIDER_ERROR";
            try{
              const controller=new AbortController();
              const timeout=setTimeout(()=>controller.abort(),12000);
              try{
                const response=await fetch("https://api.resend.com/emails",{
                  method:"POST",
                  headers:{"Authorization":"Bearer "+emailKey,
                    "Content-Type":"application/json","Idempotency-Key":key},
                  body:JSON.stringify({from:sender,to:[recipient],subject,text:summaryText,html:summaryHtml}),
                  signal:controller.signal,
                });
                success=response.ok;
                errorCode=response.status===429?"RATE_LIMITED":response.status>=500?"PROVIDER_5XX":"PROVIDER_REJECTED";
              }finally{clearTimeout(timeout);}
            }catch{errorCode="SEND_TIMEOUT_OR_NETWORK";}
            const recorded=await rpc("service_caronaa_report_finish",{
              p_cadence:cadence,p_start:start,p_end:end,p_recipient:recipient,
              p_success:success,p_error_code:success?null:errorCode,
            });
            if(success&& !recorded.error && recorded.data===true)sent++;
            else failed++;
          }
        }
        return Response.json({processed:sent+failed+skipped,sent_to_provider:sent,failed,skipped},
          {headers:{"Cache-Control":"no-store"}});
      },
    },
  },
});
