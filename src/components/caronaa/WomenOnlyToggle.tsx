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
