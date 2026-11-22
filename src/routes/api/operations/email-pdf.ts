import { createFileRoute } from "@tanstack/react-router";

/**
 * Authorized administrator-only PDF attachment delivery.
 * The client generates the same PDF that WhatsApp/file download receives.
 * Never forward the service role key to the browser.
 */
export const Route=createFileRoute("/api/operations/email-pdf")({
  server:{handlers:{POST:async({request})=>{
    const key=process.env["RESEND_API_KEY"]??"";
    const sender=process.env["CARONAA_REPORT_FROM"]??"";
    const serviceRole=process.env["SUPABASE_SERVICE_ROLE_KEY"]??"";
    if(!key||!serviceRole||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))
      return Response.json({error:"email_not_configured"},{status:503});
    const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]??"";
    if(!token||token.length>5000)
      return Response.json({error:"unauthorized"},{status:401});
    const type=request.headers.get("content-type")??"";
    if(!type.toLowerCase().startsWith("application/json"))
      return Response.json({error:"invalid_content_type"},{status:415});
    const length=Number(request.headers.get("content-length")??0);
    if(length>5_000_000)return Response.json({error:"payload_too_large"},{status:413});
    try{
      const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
      const {data:identity,error:identityError}=await supabaseAdmin.auth.getUser(token);
      if(identityError||!identity.user)return Response.json({error:"unauthorized"},{status:401});
      const {data:role,error:roleError}=await (supabaseAdmin as any)
        .from("user_roles").select("role").eq("user_id",identity.user.id).eq("role","admin").limit(1);
      if(roleError||!Array.isArray(role)||role.length===0)
        return Response.json({error:"forbidden"},{status:403});
      const raw=await request.text();
      if(raw.length>5_000_000)return Response.json({error:"payload_too_large"},{status:413});
      const payload=JSON.parse(raw) as Record<string,unknown>;
      const to=String(payload.to??"").trim().toLowerCase();
      const name=String(payload.filename??"");
      const pdf=String(payload.pdf_base64??"");
      if(to.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||
        !/^CARONAA_Relatorio_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf$/.test(name)||
        pdf.length<200||pdf.length>4_400_000||!/^[A-Za-z0-9+/=]+$/.test(pdf))
        return Response.json({error:"invalid_report"},{status:400});
      const data=Buffer.from(pdf,"base64");
      if(data.length>3_300_000||data.subarray(0,5).toString("ascii")!=="%PDF-")
        return Response.json({error:"invalid_pdf"},{status:400});
      const now=Date.now();
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch("https://api.resend.com/emails",{
          method:"POST",
          headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
          body:JSON.stringify({
            from:sender,to:[to],
            subject:"CARONAA | Relatorio de mobilidade em PDF",
            text:"Segue em anexo o relatorio operacional CARONAA em PDF, com o periodo e os indicadores selecionados no painel administrativo.",
            attachments:[{filename:name,content:pdf}],
            tags:[{name:"caronaa_type",value:"operations_pdf"}]
          }),
          signal:controller.signal
        });
        if(!response.ok){
          return Response.json({error:"provider_rejected",status:response.status},{status:502});
        }
        return Response.json({accepted_by_provider:true,requested_at:now},
          {headers:{"Cache-Control":"no-store"}});
      }finally{clearTimeout(timeout);}
    }catch{
      return Response.json({error:"email_send_failed"},{status:500});
    }
  }}}});
