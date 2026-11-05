import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { buildPixPayload } from "@/lib/pix";
import { Link } from "@tanstack/react-router";

export function DriverPixSettings() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.rpc("get_my_pix_key").then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error("Não foi possível carregar sua chave Pix.");
      else setKey(data ?? "");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section
      id="pix-do-motorista"
      className="mb-6 border-b border-border pb-6"
      aria-label="Pix do motorista"
    >
      <h2 className="mb-3 text-lg font-semibold">Pix do motorista</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.rpc("save_my_pix_key", { p_key: key.trim() });
          setBusy(false);
          if (error) toast.error(error.message);
          else toast.success("Chave Pix salva.");
        }}
      >
        <div className="min-w-0 flex-1 basis-64">
          <Label htmlFor="driver-pix">Chave Pix</Label>
          <Input
            id="driver-pix"
            value={key}
            disabled={loading}
            maxLength={77}
            onChange={(e) => setKey(e.target.value)}
            placeholder="CPF, CNPJ, e-mail, +55 ou chave aleatória"
          />
        </div>
        <Button disabled={loading || busy} type="submit">
          {busy ? "Salvando…" : "Salvar Pix"}
        </Button>
      </form>
    </section>
  );
}

type RidePix = {
  key: string | null;
  name: string | null;
  amount: number;
  passengerCount: number;
  pricePerPassenger: number;
  paymentMethod: "MANUAL_DRIVER_PIX";
  automaticConfirmation: false;
};

export function CompletedRidePix({ rideId, role }: { rideId: string; role: "driver" | "passenger" }) {
  const [data, setData] = useState<RidePix | null>(null);
  const [image, setImage] = useState("");
  const [payload, setPayload] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setData(null);
    setImage("");
    setPayload("");
    setError("");
    void (async () => {
      const { data: result, error: queryError } = await supabase.rpc("get_ride_pix", { p_ride_id: rideId });
      if (queryError) throw new Error(queryError.message);
      const pix = result as unknown as RidePix;
      if (!pix || !Number.isFinite(Number(pix.amount)) || Number(pix.amount) <= 0 ||
          !Number.isInteger(Number(pix.passengerCount)) || Number(pix.passengerCount) < 1 ||
          !Number.isFinite(Number(pix.pricePerPassenger)) ||
          Math.round(Number(pix.pricePerPassenger) * Number(pix.passengerCount) * 100) !==
          Math.round(Number(pix.amount) * 100)) {
        throw new Error("O preço desta reserva está inconsistente. Não realize Pix antes da revisão.");
      }
      if (!active) return;
      setData(pix);
      if (pix.key) {
        const code = buildPixPayload(pix.key, pix.name || "Motorista", Number(pix.amount));
        const qr = await QRCode.toDataURL(code, { width: 240, margin: 2 });
        if (active) { setPayload(code); setImage(qr); }
      }
    })().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o Pix da viagem.");
    });
    return () => { active = false; };
  }, [rideId]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Código Pix copiado.");
    } catch { toast.error("Não foi possível copiar. Copie a chave manualmente."); }
  }

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Carregando Pix…</p>;
  if (!data.key) return (
    <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
      O motorista ainda não cadastrou uma chave Pix.{" "}
      {role === "driver" ? (
        <Link className="font-semibold text-primary underline" to="/perfil" hash="pix-do-motorista">Cadastrar minha chave</Link>
      ) : "Peça ao motorista que cadastre uma chave antes de transferir."}
    </p>
  );
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-foreground"
      aria-label="Pix direto para o motorista">
      <h4 className="text-center text-base font-bold">Pix direto para o motorista</h4>
      <p className="text-center text-sm font-semibold">
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(data.amount))}
        {" "}· {data.passengerCount} {data.passengerCount === 1 ? "passageiro deste pedido" : "passageiros deste pedido"}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(data.pricePerPassenger))}
        {" "}por passageiro solicitado. Vagas livres do motorista não entram neste valor.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Transferência manual para a conta do motorista. O aplicativo não verifica recebimento,
        não cobra comissão e não altera o status do pagamento. Confirme os dados no aplicativo bancário.
      </p>
      {image && <img src={image} alt="QR Code Pix manual da viagem" width={240} height={240}
        className="max-w-full rounded-lg bg-white p-2" />}
      <p className="max-w-full break-all text-center font-mono text-sm">{data.key}</p>
      <div className="flex w-full flex-wrap justify-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy(data.key!)}>Copiar chave Pix</Button>
        {payload && <Button type="button" size="sm" onClick={() => void copy(payload)}>Copiar Pix copia e cola</Button>}
      </div>
      {role === "driver" && <p className="text-xs text-muted-foreground">Confira o recebimento no aplicativo do banco; este QR não comprova pagamento.</p>}
    </section>
  );
}
