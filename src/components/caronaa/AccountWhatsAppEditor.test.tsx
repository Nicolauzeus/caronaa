import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountWhatsAppEditor } from "./AccountWhatsAppEditor";

const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));

beforeEach(()=>{
  vi.resetAllMocks();
  api.rpc.mockImplementation(async(name:string)=>{
    if(name==="get_my_caronaa_whatsapp")return {data:{whatsapp:null,contact_consent:false},error:null};
    if(name==="set_my_caronaa_whatsapp")return {data:{whatsapp:null,contact_consent:false},error:null};
    return {data:null,error:{message:"unexpected"}};
  });
});
afterEach(cleanup);

describe("F02/F07: optional editable WhatsApp per account",()=>{
  it("does not block the profile when no number was provided",async()=>{
    render(<AccountWhatsAppEditor/>);
    expect(await screen.findByLabelText(/WhatsApp para contato/)).toHaveValue("");
    expect(screen.getByText(/não é necessário para fazer ou aceitar corridas/)).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Remover contato"})).toBeEnabled());
  });
  it("accepts DDD 55 and saves E.164, without granting CRM consent by default",async()=>{
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="get_my_caronaa_whatsapp")return {data:{whatsapp:null,contact_consent:false},error:null};
      if(name==="set_my_caronaa_whatsapp")return {data:{whatsapp:"+5555999991234",contact_consent:false},error:null};
      return {data:null,error:{message:"unexpected"}};
    });
    render(<AccountWhatsAppEditor/>);
    const field=await screen.findByLabelText(/WhatsApp para contato/);
    await waitFor(()=>expect(field).not.toBeDisabled());
    fireEvent.change(field,{target:{value:"(55) 99999-1234"}});
    fireEvent.click(screen.getByRole("button",{name:"Salvar WhatsApp"}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("set_my_caronaa_whatsapp",{
      p_whatsapp:"+5555999991234",p_contact_consent:false,
    }));
    expect(await screen.findByText(/Contato atualizado/)).toBeInTheDocument();
  });
  it("accepts numbers with country code and does not duplicate 55",async()=>{
    render(<AccountWhatsAppEditor/>);
    const field=await screen.findByLabelText(/WhatsApp para contato/);
    await waitFor(()=>expect(field).not.toBeDisabled());
    fireEvent.change(field,{target:{value:"+55 (85) 99999-1234"}});
    expect(field).toHaveValue("(85) 99999-1234");
    expect(screen.getByRole("button",{name:"Salvar WhatsApp"})).toBeEnabled();
  });
  it("rejects invalid DDD without asserting that a WhatsApp account does not exist",async()=>{
    render(<AccountWhatsAppEditor/>);
    const field=await screen.findByLabelText(/WhatsApp para contato/);
    await waitFor(()=>expect(field).not.toBeDisabled());
    fireEvent.change(field,{target:{value:"(20) 99999-1234"}});
    expect(screen.getByText(/Use um DDD brasileiro válido/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Salvar WhatsApp"})).toBeDisabled();
  });
  it("preserves the typed phone when saving fails and permits retry",async()=>{
    let attempts=0;
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="get_my_caronaa_whatsapp")return {data:{whatsapp:null,contact_consent:false},error:null};
      if(name==="set_my_caronaa_whatsapp"){
        attempts++;
        return attempts===1
          ?{data:null,error:{message:"network unavailable"}}
          :{data:{whatsapp:"+5511999991234",contact_consent:false},error:null};
      }
      return {data:null,error:{message:"unexpected"}};
    });
    render(<AccountWhatsAppEditor/>);
    const field=await screen.findByLabelText(/WhatsApp para contato/);
    await waitFor(()=>expect(field).not.toBeDisabled());
    fireEvent.change(field,{target:{value:"(11) 99999-1234"}});
    fireEvent.click(screen.getByRole("button",{name:"Salvar WhatsApp"}));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível salvar/);
    expect(field).toHaveValue("(11) 99999-1234");
    expect(screen.getByRole("button",{name:"Salvar WhatsApp"})).toBeEnabled();
    fireEvent.click(screen.getByRole("button",{name:"Salvar WhatsApp"}));
    expect(await screen.findByText(/Contato atualizado/)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
  it("allows removing an existing phone and explicit opt-out",async()=>{
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="get_my_caronaa_whatsapp")return {data:{whatsapp:"+5585999991234",contact_consent:true},error:null};
      if(name==="set_my_caronaa_whatsapp")return {data:{whatsapp:null,contact_consent:false},error:null};
      return {data:null,error:{message:"unexpected"}};
    });
    render(<AccountWhatsAppEditor/>);
    const field=await screen.findByLabelText(/WhatsApp para contato/);
    await waitFor(()=>expect(field).not.toBeDisabled());
    expect(field).toHaveValue("(85) 99999-1234");
    fireEvent.change(field,{target:{value:""}});
    fireEvent.click(screen.getByRole("button",{name:"Remover contato"}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("set_my_caronaa_whatsapp",{
      p_whatsapp:null,p_contact_consent:false,
    }));
    expect(await screen.findByText(/Contato removido/)).toBeInTheDocument();
  });
});
