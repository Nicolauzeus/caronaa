import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

type Props = { payload: string; alt: string; pixKey?: string };

/** The image is an optional representation of the exact same bank payload. */
export function PixPaymentCode(props: Props) {
  return <IssuedCode key={props.payload} {...props} />;
}

function IssuedCode({ payload, alt, pixKey }: Props) {
  const [image, setImage] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const manual = useRef<HTMLTextAreaElement>(null);
  const keyText = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const url = await QRCode.toDataURL(payload, { scale: 6, margin: 4 });
        if (active) setImage(url);
      } catch {
        if (active) setImageFailed(true);
      }
    })();
    return () => { active = false; };
  }, [payload]);

  async function copy(value: string, rawKey = false) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(rawKey ? "Chave Pix copiada." : "Código Pix copiado.");
    } catch {
      if (details.current) details.current.open = true;
      const field = rawKey ? keyText.current : manual.current;
      field?.focus();
      field?.select();
      setNotice("O texto está selecionado. Use a opção Copiar do seu dispositivo.");
    }
  }

  return <div className="w-full min-w-0 space-y-2">
    {image && <img src={image} alt={alt} width={240} height={240}
      className="mx-auto h-auto w-48 max-w-full bg-white sm:w-60" style={{ imageRendering: "pixelated" }} />}
    {imageFailed && <p role="status" className="text-sm">A imagem do QR está indisponível. Use o Pix Copia e Cola.</p>}
    <Button type="button" className="min-h-11 w-full" onClick={() => void copy(payload)}>Copiar Pix Copia e Cola</Button>
    <details ref={details} className="min-w-0 text-sm">
      <summary className="cursor-pointer py-1">Ver código Pix</summary>
      <textarea aria-label="Código Pix Copia e Cola" ref={manual} readOnly rows={2} value={payload}
        className="mt-2 w-full rounded-lg border border-border bg-background p-2 font-mono text-xs text-foreground" />
      {pixKey && <div>
        <input ref={keyText} readOnly aria-label="Chave Pix do recebedor" value={pixKey}
          className="w-full bg-transparent font-mono text-sm" />
        <Button type="button" size="sm" variant="outline" onClick={() => void copy(pixKey, true)}>Copiar somente a chave</Button>
      </div>}
    </details>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </div>;
}
