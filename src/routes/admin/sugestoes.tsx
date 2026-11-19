import { brazilWhatsappChatUrl } from "@/lib/contacts/brazil-whatsapp";
import { ListPagination } from "@/components/admin/ListPagination";
// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  HeartHandshake,
  Mail,
  MessageSquare,
  MessageSquareHeart,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSTITUTION_TYPE_LABELS,
  PitchContact,
  PitchSuggestionStatus,
  SUGGESTION_STATUS_LABELS,
} from "@/lib/pitch/types";
import {
  getPitchContacts,
  updatePitchSuggestionStatus,
} from "@/lib/pitch/pitch-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/sugestoes")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Sugestões & Perguntas — Administração CARONAA" },
      {
        property: "og:description",
        content: "Acompanhe todas as perguntas e sugestões enviadas através da página do Pitch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        title: "Sugestões & Perguntas — Administração CARONAA",
      },
      {
        name: "description",
        content: "Acompanhe todas as perguntas e sugestões enviadas através da página do Pitch.",
      },
    ],
  }),
  component: AdminSugestoesPage,
});

export function AdminSugestoesPage() {
  const [page, setPage] = useState(0);
  const [contacts, setContacts] = useState<PitchContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await getPitchContacts();
      if (res.error) throw new Error(res.error);
      setContacts(res.data);
    } catch {
      toast.error("Erro ao carregar sugestões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContacts();
  }, []);

  const handleSuggestionStatusChange = async (id: string, newStatus: PitchSuggestionStatus) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, suggestion_status: newStatus } : c)),
    );

    try {
      const result = await updatePitchSuggestionStatus(id, newStatus);
      if (!result.success) throw new Error(result.error);
      toast.success(`Status da sugestão atualizado para "${SUGGESTION_STATUS_LABELS[newStatus]}"`);
    } catch {
      toast.error("Erro ao atualizar status da sugestão.");
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = contacts.length;
    const novas = contacts.filter((c) => c.suggestion_status === "NOVA").length;
    const emAnalise = contacts.filter((c) => c.suggestion_status === "EM_ANALISE").length;
    const respondidas = contacts.filter((c) => c.suggestion_status === "RESPONDIDA").length;
    const arquivadas = contacts.filter((c) => c.suggestion_status === "ARQUIVADA").length;

    return { total, novas, emAnalise, respondidas, arquivadas };
  }, [contacts]);

  // Filtered
  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (statusFilter !== "TODOS" && c.suggestion_status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesMsg = c.message.toLowerCase().includes(q);
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesInst = c.institution_name
          ? c.institution_name.toLowerCase().includes(q)
          : false;
        if (!matchesMsg && !matchesName && !matchesInst) {
          return false;
        }
      }
      return true;
    });
  }, [contacts, statusFilter, search]);

  useEffect(() => setPage(0), [filtered]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1));
  const getStatusBadge = (status: PitchSuggestionStatus) => {
    switch (status) {
      case "NOVA":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Nova</Badge>
        );
      case "EM_ANALISE":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Em Análise</Badge>
        );
      case "RESPONDIDA":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">Respondida</Badge>
        );
      case "ARQUIVADA":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Arquivada
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
            Sugestões & Perguntas do Pitch
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feedbacks, dúvidas e insights enviados diretamente pelo público da CARONAA.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchContacts}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard
          label="Total Sugestões"
          value={String(metrics.total)}
          detail="Recebidas no pitch"
        />
        <MetricCard label="Novas" value={String(metrics.novas)} detail="Aguardando leitura" />
        <MetricCard
          label="Em Análise"
          value={String(metrics.emAnalise)}
          detail="Em discussão de produto"
        />
        <MetricCard
          label="Respondidas"
          value={String(metrics.respondidas)}
          detail="Contato realizado"
        />
        <MetricCard label="Arquivadas" value={String(metrics.arquivadas)} detail="Histórico" />
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              placeholder="Buscar no texto das mensagens, nomes ou instituições..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="w-full sm:w-52">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status da Sugestão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os Status</SelectItem>
                <SelectItem value="NOVA">Nova</SelectItem>
                <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
                <SelectItem value="RESPONDIDA">Respondida</SelectItem>
                <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse">
          Carregando sugestões...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <MessageSquareHeart className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <h3 className="font-semibold text-foreground">Nenhuma sugestão encontrada</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Nenhuma mensagem corresponde aos filtros atuais.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.slice(currentPage * 8, (currentPage + 1) * 8).map((item) => {
            const baseWhatsappLink=brazilWhatsappChatUrl(item.whatsapp);
            const waLink=baseWhatsappLink?baseWhatsappLink+"?text="+encodeURIComponent(
              `Olá ${item.name}! Agradecemos por compartilhar sua mensagem com a equipe da CARONAA.`
            ):null;

            return (
              <Card
                key={item.id}
                className="hover:border-amber-500/40 transition-colors duration-200"
              >
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-base text-foreground">{item.name}</span>
                    {getStatusBadge(item.suggestion_status)}
                    {item.interest === "INVESTIDOR" && (
                      <Badge
                        variant="outline"
                        className="text-amber-600 border-amber-500/30 gap-1 text-[11px]"
                      >
                        <Coins className="w-3 h-3" /> Investidor
                      </Badge>
                    )}
                    {item.interest === "PARCEIRO" && (
                      <Badge
                        variant="outline"
                        className="text-blue-600 border-blue-500/30 gap-1 text-[11px]"
                      >
                        <Building2 className="w-3 h-3" /> Parceiro
                      </Badge>
                    )}
                    {item.interest === "AMBOS" && (
                      <Badge
                        variant="outline"
                        className="text-purple-600 border-purple-500/30 gap-1 text-[11px]"
                      >
                        <HeartHandshake className="w-3 h-3" /> Investidor + Parceiro
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(item.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* The Message Box */}
                  <div className="p-4 bg-muted/60 rounded-xl border border-border text-foreground font-normal text-sm leading-relaxed whitespace-pre-wrap">
                    <details>
                      <summary className="cursor-pointer line-clamp-2">{item.message}</summary>
                      <p className="mt-3 whitespace-pre-wrap">{item.message}</p>
                    </details>
                  </div>

                  {/* Metadata footer with quick status and contact action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {item.institution_name && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          {item.institution_name}
                          {item.institution_type && (
                            <span className="text-muted-foreground">
                              ({INSTITUTION_TYPE_LABELS[item.institution_type]})
                            </span>
                          )}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        {item.whatsapp}
                      </span>

                      {item.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-blue-500" />
                          {item.email}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-36">
                        <Select
                          value={item.suggestion_status}
                          onValueChange={(val) =>
                            handleSuggestionStatusChange(item.id, val as PitchSuggestionStatus)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NOVA">Nova</SelectItem>
                            <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
                            <SelectItem value="RESPONDIDA">Respondida</SelectItem>
                            <SelectItem value="ARQUIVADA">Arquivada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {waLink?<Button asChild size="sm" variant="default"
                        className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <a href={waLink} target="_blank" rel="noreferrer">
                          <Phone className="w-3.5 h-3.5"/> Responder no WhatsApp
                          <ExternalLink className="w-3 h-3"/>
                        </a>
                      </Button>:<span className="text-xs text-muted-foreground">WhatsApp indisponível</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ListPagination page={currentPage} total={filtered.length} pageSize={8} onChange={setPage} />
    </div>
  );
}
