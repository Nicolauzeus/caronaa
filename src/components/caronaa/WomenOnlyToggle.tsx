import { Link } from "@tanstack/react-router";
import type { ProfileGender } from "@/lib/use-profile-gender";
import { Switch } from "@/components/ui/switch";
export function WomenOnlyToggle({
  gender,
  checked,
  onChange,
  kind,
}: {
  gender: ProfileGender;
  checked: boolean;
  onChange: (checked: boolean) => void;
  kind: "request" | "offer";
}) {
  if (gender == null && kind === "request")
    return (
      <p className="text-xs leading-relaxed text-gray-400">
        Mulheres podem ativar caronas exclusivas completando o gênero no{" "}
        <Link to="/perfil" className="font-semibold text-[#FFBB00] underline underline-offset-4">
          Perfil
        </Link>
        .
      </p>
    );
  if (gender !== "FEMININO") return null;
  const id = `women-only-${kind}`;
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
      <label htmlFor={id} className="cursor-pointer text-sm font-semibold">
        🌸 {kind === "offer" ? "Aceitar apenas passageiras mulheres" : "Carona entre mulheres"}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="shrink-0 data-[state=checked]:bg-[#FFBB00]"
      />
    </div>
  );
}
