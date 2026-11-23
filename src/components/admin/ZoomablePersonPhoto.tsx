import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ZoomablePersonPhotoProps = {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
};

/**
 * User photos expand in an accessible dialog. Accounts with no valid image
 * keep the initials placeholder without a misleading click target.
 */
export function ZoomablePersonPhoto({ name, src, size = "md" }: ZoomablePersonPhotoProps) {
  const [open, setOpen] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const isPhotoAvailable = Boolean(src) && !thumbnailFailed;
  const dimensions = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  const avatar = (
    <Avatar className={dimensions + " shrink-0"}>
      <AvatarImage src={src || undefined} alt={name} onLoadingStatusChange={(status) => { if (status === "error") setThumbnailFailed(true); }} />
      <AvatarFallback className="bg-[#FFBB00]/15 text-xs font-semibold">{initials}</AvatarFallback>
    </Avatar>
  );

  if (!isPhotoAvailable) return avatar;

  return (
    <>
      <button
        type="button"
        onClick={() => { setPreviewFailed(false); setOpen(true); }}
        title={"Ampliar foto de " + name}
        aria-label={"Ampliar foto de " + name}
        className="shrink-0 cursor-zoom-in rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#FFBB00] focus-visible:ring-offset-2"
      >
        {avatar}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] overflow-hidden p-4 sm:max-w-xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Foto de {name}</DialogTitle>
            <DialogDescription>Visualização ampliada da foto cadastrada.</DialogDescription>
          </DialogHeader>
          {previewFailed ? (
            <p role="status" className="rounded-xl bg-muted p-8 text-center text-sm text-muted-foreground">
              Não foi possível carregar esta foto.
            </p>
          ) : (
            <img
              src={src || undefined}
              alt={"Foto ampliada de " + name}
              onError={() => setPreviewFailed(true)}
              className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
