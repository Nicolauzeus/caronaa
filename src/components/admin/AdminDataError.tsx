import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminErrorMessage } from "@/lib/admin/error-message";

export function AdminDataError({ error, retry }: { error: unknown; retry?: () => void }) {
  useEffect(() => {
    if (error) console.error("[Admin] Falha ao consultar ou atualizar dados", error);
  }, [error]);
  if (!error) return null;
  const reason = typeof error === "string" ? { message: error } : error;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive py-3 pl-3 text-sm"
    >
      <p>{adminErrorMessage(reason)}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw size={14} /> Tentar novamente
        </Button>
      )}
    </div>
  );
}
