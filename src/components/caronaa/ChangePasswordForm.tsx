import { useState, type FormEvent } from "react";
import { LockKeyhole, Eye, EyeOff, Check, ShieldAlert, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function ChangePasswordForm({ id }: { id?: string }) {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!user) return null;

  const hasMinLength = newPassword.length >= 6;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setSuccess(false);

    if (!hasMinLength) {
      setFieldError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldError("As senhas informadas não conferem.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setFieldError(error.message);
        toast.error("Não foi possível alterar a senha.", {
          description: error.message,
        });
      } else {
        setSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Sua senha foi alterada com sucesso.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar senha.";
      setFieldError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={id} className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary shrink-0">
          <KeyRound size={22} />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">
            Alterar senha da conta
          </h2>
          <p className="text-xs text-muted-foreground">
            Defina uma nova credencial de acesso segura para a sua conta CARONAA.
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs text-foreground">
          <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground">Senha atualizada com sucesso!</p>
            <p className="text-muted-foreground mt-0.5">
              Suas novas credenciais já estão ativas e válidas para o próximo acesso.
            </p>
          </div>
        </div>
      )}

      {fieldError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <span>{fieldError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="space-y-1.5">
          <Label htmlFor="change-password-new" className="text-xs font-semibold text-foreground">
            Nova senha
          </Label>
          <div className="relative">
            <LockKeyhole
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={17}
            />
            <Input
              id="change-password-new"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldError) setFieldError(null);
                if (success) setSuccess(false);
              }}
              placeholder="Mínimo de 6 caracteres"
              className="h-12 rounded-xl border-border bg-background px-10 text-sm font-medium shadow-inner"
              minLength={6}
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 size-10"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="change-password-confirm" className="text-xs font-semibold text-foreground">
            Confirmar nova senha
          </Label>
          <div className="relative">
            <LockKeyhole
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={17}
            />
            <Input
              id="change-password-confirm"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldError) setFieldError(null);
                if (success) setSuccess(false);
              }}
              placeholder="Repita a nova senha"
              className="h-12 rounded-xl border-border bg-background px-10 text-sm font-medium shadow-inner"
              minLength={6}
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 size-10"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Ocultar confirmação" : "Ver confirmação"}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </div>

        {/* Indicadores visuais de requisitos */}
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 space-y-1.5 text-xs">
          <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
            Requisitos da senha
          </p>
          <div className="flex items-center gap-2">
            <div
              className={`flex size-4 items-center justify-center rounded-full ${
                hasMinLength ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Check size={11} strokeWidth={3} />
            </div>
            <span className={hasMinLength ? "text-foreground font-medium" : "text-muted-foreground"}>
              Mínimo de 6 caracteres
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex size-4 items-center justify-center rounded-full ${
                passwordsMatch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Check size={11} strokeWidth={3} />
            </div>
            <span className={passwordsMatch ? "text-foreground font-medium" : "text-muted-foreground"}>
              As senhas são idênticas
            </span>
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-md hover:opacity-90"
          disabled={busy || !hasMinLength || !passwordsMatch}
        >
          {busy ? "Salvando nova senha..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}

