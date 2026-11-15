import { useState } from "react";
import { CarFront, UserRound, ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ActiveRole } from "@/lib/role/use-active-role";

type Props = {
  activeRole: ActiveRole;
  disabled?: boolean;
  onSwitch: (role: ActiveRole) => Promise<void> | void;
};

export function RoleSwitchHeader({ activeRole, disabled = false, onSwitch }: Props) {
  const [pendingRole, setPendingRole] = useState<ActiveRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    if (!pendingRole || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSwitch(pendingRole);
      setPendingRole(null);
    } catch {
      setError("Não foi possível trocar o papel agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return <>
    <nav aria-label="Papel ativo no CARONAA"
      className="pointer-events-auto inline-flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full border border-[#FFBB00]/50 bg-[#121212]/95 p-1 text-white shadow-xl backdrop-blur-xl"
      style={{fontFamily:"Manrope, sans-serif"}}>
      {(["PASSAGEIRO","MOTORISTA"] as const).map(role => {
        const selected = role === activeRole;
        return <button type="button" key={role}
          disabled={disabled || selected}
          aria-pressed={selected}
          onClick={() => { setError(""); setPendingRole(role); }}
          className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors sm:px-5 sm:text-sm ${selected ? "bg-[#FFBB00] text-[#121212]" : "text-white hover:bg-white/15"} disabled:cursor-default`}>
          {role === "PASSAGEIRO" ? <UserRound size={16}/> : <CarFront size={16}/>}
          {role === "PASSAGEIRO" ? "Passageiro" : "Motorista"}
          {selected && <span aria-label="Ativo" className="rounded-full bg-[#121212]/15 px-1.5 text-[10px]">Ativo</span>}
        </button>;
      })}
    </nav>
    <Dialog open={pendingRole !== null} onOpenChange={open => { if (!open && !busy) setPendingRole(null); }}>
      <DialogContent className="max-w-sm border-[#FFBB00]/40 bg-[#121212] text-white" style={{fontFamily:"Manrope, sans-serif"}}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-display)]">
            <ArrowLeftRight className="text-[#FFBB00]" size={20}/> Trocar papel
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Deseja mudar para {pendingRole === "MOTORISTA" ? "Motorista" : "Passageiro"}?
            Essa opção altera apenas o papel ativo da sua conta.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setPendingRole(null)}>Cancelar</Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}
            className="bg-[#FFBB00] font-bold text-[#121212] hover:bg-[#ffd24d]">{busy ? "Alterando..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
