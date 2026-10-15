import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StsJourneyActivation } from "@/components/caronaa/StsJourneyActivation";

const api = vi.hoisted(() => ({ getDraft: vi.fn(), publish: vi.fn(), getAccount: vi.fn(), confirm: vi.fn(), metadata: "b51c1e71-59d8-4aab-850a-af4a584fc103" }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/formulario/ride-activation.functions", () => ({ getStsRideDraft: api.getDraft, publishStsRide: api.publish }));
vi.mock("@/lib/formulario/account-activation", () => ({ getFormAccountActivation: api.getAccount, confirmFormAccountActivation: api.confirm }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id:"user",user_metadata:{submission_id:api.metadata} } }) }));

describe("Ativação na entrada da home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.metadata = "b51c1e71-59d8-4aab-850a-af4a584fc103";
    api.getAccount.mockResolvedValue({ status:"ready",submission:{submissionId:api.metadata} });
    api.confirm.mockResolvedValue({status:"confirmed"});
    api.getDraft.mockResolvedValue(null);
  });
  it("vincula automaticamente somente a resposta explicitamente usada no cadastro", async () => {
    api.getDraft.mockResolvedValueOnce(null).mockResolvedValueOnce({ classification:"partial",details:{origin:"CEC",destination:"Aldeota"},publicationId:null });
    render(<StsJourneyActivation hasActive={false} onPublished={vi.fn()}/>);
    await screen.findByRole("button",{name:"Concluir publicação"});
    expect(api.confirm).toHaveBeenCalledWith(api.metadata,{});
    expect(api.publish).not.toHaveBeenCalled();
  });
  it("não vincula silenciosamente uma resposta diferente do cadastro", async () => {
    api.getAccount.mockResolvedValue({status:"ready",submission:{submissionId:"b51c1e71-59d8-4aab-850a-af4a584fc104"}});
    render(<StsJourneyActivation hasActive={false} onPublished={vi.fn()}/>);
    await screen.findByRole("button",{name:"Vincular meu formulário"});
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it("recupera publicação existente sem pedir novos dados ou publicar outra", async () => {
    api.getDraft.mockResolvedValue({publicationId:"existing"});
    const onPublished = vi.fn();
    render(<StsJourneyActivation hasActive={true} onPublished={onPublished}/>);
    await waitFor(() => expect(onPublished).toHaveBeenCalledOnce());
    expect(api.publish).not.toHaveBeenCalled();
    expect(api.getAccount).not.toHaveBeenCalled();
  });
});
