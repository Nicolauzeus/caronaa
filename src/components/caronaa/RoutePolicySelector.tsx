export function RoutePolicySelector({
  allowDetours,
  onChange,
}: {
  allowDetours: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="space-y-2 rounded-2xl border border-[#FFBB00]/30 bg-[#121212] p-4 text-white">
      <legend className="px-1 text-sm font-bold">Tolerância de trajeto</legend>
      {[
        {
          value: false,
          title: "Rota Estrita (Ponto de encontro)",
          text: "Você segue sua rota. O passageiro pode caminhar até um ponto sugerido na via; combinem um local permitido para parar.",
        },
        {
          value: true,
          title: "Aceitar pequenos desvios",
          text: "Permite sugestões perto da rota, dentro dos limites atuais de desvio. Cada alteração continua dependendo do seu aceite.",
        },
      ].map((item) => (
        <label
          key={item.title}
          className={
            "flex min-h-14 cursor-pointer gap-3 rounded-xl border p-3 " +
            (allowDetours === item.value
              ? "border-[#FFBB00]"
              : "border-white/20")
          }
        >
          <input
            type="radio"
            name="route-policy"
            checked={allowDetours === item.value}
            onChange={() => onChange(item.value)}
            className="mt-1 size-4 accent-[#FFBB00]"
          />
          <span>
            <strong className="block text-sm">{item.title}</strong>
            <span className="mt-1 block text-xs text-white/75">
              {item.text}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
