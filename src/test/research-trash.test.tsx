import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResearchFormRemovalDialog } from "@/components/admin/ResearchFormRemovalDialog";
import type { ResearchForm, ResearchRemovalEligibility } from "@/lib/formulario/research-catalog";

const mocked = vi.hoisted(() => ({
  eligibility: vi.fn(),
  archive: vi.fn(),
  trash: vi.fn(),
  restore: vi.fn(),
  purge: vi.fn(),
  assets: vi.fn(),
}));
vi.mock("@/lib/formulario/research-catalog", () => ({
  getResearchFormRemovalEligibility: mocked.eligibility,
  archiveResearchForm: mocked.archive,
  trashResearchForm: mocked.trash,
  restoreTrashedResearchForm: mocked.restore,
  permanentlyDeleteTrashedResearchForm: mocked.purge,
  removeTrashedResearchBrandAssets: mocked.assets,
}));
const form: ResearchForm = {
  id: "research-test", code: "TESTE-2026", title: "Pesquisa teste",
  nature: "EVENTO", audience: "GERAL", mobility_mode: "COMPARTILHADA",
  municipality: null, status: "PUBLICADO", is_enabled: true,
  created_at: "2026-10-18T00:00:00Z",
};
const eligible: ResearchRemovalEligibility = {
  code: form.code, status: "PUBLICADO", answers: 2,
  legacy_submissions: 0, crm_leads: 0, partner_pilots: 0,
  participation_badges: 0, brand_assets: 0,
  in_trash: false, can_trash: true, can_restore: false, can_delete: false,
};
function fixture(override: Partial<ResearchRemovalEligibility>) {
  mocked.eligibility.mockResolvedValue({ ...eligible, ...override });
}

describe("Research trash confirmation and preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture({});
    mocked.trash.mockResolvedValue(undefined);
    mocked.restore.mockResolvedValue(undefined);
    mocked.purge.mockResolvedValue(undefined);
  });

  it("allows trashing a published survey with answers while preserving its data", async () => {
    const onCompleted = vi.fn();
    render(<ResearchFormRemovalDialog form={form} onClose={vi.fn()} onCompleted={onCompleted} />);
    expect(await screen.findByText(/Respostas:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir definitivamente pesquisa/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mover para a lixeira" }));
    await waitFor(() => expect(mocked.trash).toHaveBeenCalledWith(form));
    expect(onCompleted).toHaveBeenCalled();
    expect(mocked.purge).not.toHaveBeenCalled();
  });

  it("restores a trashed survey without hard-deleting it", async () => {
    fixture({ in_trash: true, can_trash: false, can_restore: true, can_delete: true, status: "ARQUIVADO" });
    const trashed = { ...form, is_enabled: false, status: "ARQUIVADO", trashed_at: "2026-10-18T00:00:00Z" };
    render(<ResearchFormRemovalDialog form={trashed} onClose={vi.fn()} onCompleted={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Restaurar pesquisa" }));
    await waitFor(() => expect(mocked.restore).toHaveBeenCalledWith(trashed));
    expect(mocked.purge).not.toHaveBeenCalled();
  });

  it("does not show irreversible deletion if badges are attached", async () => {
    fixture({
      in_trash: true, can_trash: false, can_restore: true,
      participation_badges: 1, can_delete: false, status: "ARQUIVADO",
    });
    render(<ResearchFormRemovalDialog form={{ ...form, trashed_at: "2026-10-18T00:00:00Z" }}
      onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(await screen.findByText(/Exclusão definitiva bloqueada por vínculos/)).toBeInTheDocument();
    expect(screen.getByText(/Selos de participação: 1/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir definitivamente pesquisa/ })).not.toBeInTheDocument();
  });

  it("requires code, exact phrase and explicit acknowledgement before deleting 2 responses", async () => {
    fixture({ in_trash: true, can_trash: false, can_restore: true, can_delete: true, status: "ARQUIVADO" });
    const trashed = { ...form, trashed_at: "2026-10-18T00:00:00Z" };
    render(<ResearchFormRemovalDialog form={trashed} onClose={vi.fn()} onCompleted={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "Excluir definitivamente pesquisa e respostas" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(form.code), { target: { value: form.code } });
    fireEvent.change(screen.getByPlaceholderText("EXCLUIR DEFINITIVAMENTE"), {
      target: { value: "EXCLUIR DEFINITIVAMENTE" },
    });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocked.purge).toHaveBeenCalledWith(
        trashed, form.code, "EXCLUIR DEFINITIVAMENTE", 2,
      ),
    );
  });

  it("fails closed when dependency audit cannot be fetched", async () => {
    mocked.eligibility.mockRejectedValueOnce(new Error("Acesso indisponível"));
    render(<ResearchFormRemovalDialog form={form} onClose={vi.fn()} onCompleted={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Acesso indisponível");
    expect(screen.queryByRole("button", { name: "Mover para a lixeira" })).not.toBeInTheDocument();
  });
});
