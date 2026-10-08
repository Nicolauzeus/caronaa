// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  Eye,
  Filter,
  HeartHandshake,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_STATUS_LABELS,
  INSTITUTION_TYPE_LABELS,
  INVESTOR_UPDATE_LABELS,
  PARTNERSHIP_TYPE_LABELS,
  PitchContact,
  PitchContactStatus,
  PitchInterest,
} from "@/lib/pitch/types";
import {
  exportPitchContactsToCsv,
  getPitchContacts,
  normalizePhoneNumber,
  updatePitchContactNotes,
  updatePitchContactStatus,
} from "@/lib/pitch/pitch-service";

export const Route = createFileRoute("/admin/relacionamentos")({
  head: () => ({
    meta: [{ property: "og:title", content: "Relacionamentos & Pitch — Administração CARONAA" },
{ property: "og:description", content: "Gestão de contatos, possíveis investidores e parceiros do Pitch STS 2026." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
      {
        title: "Relacionamentos & Pitch — Administração CARONAA",
      },
      {
        name: "description",
        content: "Gestão de contatos, possíveis investidores e parceiros do Pitch STS 2026.",
      },
    ],
  }),
  component: AdminRelacionamentosPage,
});

export function AdminRelacionamentosPage() {
  const [contacts, setContacts] = useState<PitchContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState<string>("TODOS");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");

  // Selected contact for detail modal & notes
  const [selectedContact, setSelectedContact] = useState<PitchContact | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await getPitchContacts();
      setContacts(res.data);
    } catch (err) {
      toast.error("Erro ao carregar contatos de relacionamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContacts();
  }, []);

  const handleStatusChange = async (id: string, newStatus: PitchContactStatus) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
    if (selectedContact && selectedContact.id === id) {
      setSelectedContact((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      await updatePitchContactStatus(id, newStatus);
      toast.success(`Status atualizado para "${CONTACT_STATUS_LABELS[newStatus]}"`);
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleOpenDetails = (contact: PitchContact) => {
    setSelectedContact(contact);
    setEditingNotes(contact.notes || "");
  };

  const handleSaveNotes = async () => {
    if (!selectedContact) return;
    try {
      setIsSavingNotes(true);
      await updatePitchContactNotes(selectedContact.id, editingNotes);
      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContact.id ? { ...c, notes: editingNotes } : c)),
      );
      setSelectedContact((prev) => (prev ? { ...prev, notes: editingNotes } : null));
      toast.success("Anotações salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar anotações.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = contacts.length;
    const investors = contacts.filter((c) => c.interest === "INVESTIDOR").length;
    const partners = contacts.filter((c) => c.interest === "PARCEIRO").length;
    const both = contacts.filter((c) => c.interest === "AMBOS").length;
    const newContacts = contacts.filter((c) => c.status === "NOVO").length;
    const inFollowUp = contacts.filter((c) => c.status === "EM_ACOMPANHAMENTO").length;
    const converted = contacts.filter((c) => c.status === "CONVERTIDO").length;

    return { total, investors, partners, both, newContacts, inFollowUp, converted };
  }, [contacts]);

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (interestFilter !== "TODOS" && contact.interest !== interestFilter) {
        return false;
      }
      if (statusFilter !== "TODOS" && contact.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = contact.name.toLowerCase().includes(q);
        const matchesWa = contact.whatsapp.includes(q);
        const matchesPhone = contact.phone ? contact.phone.includes(q) : false;
        const matchesEmail = contact.email ? contact.email.toLowerCase().includes(q) : false;
        const matchesInst = contact.institution_name
          ? contact.institution_name.toLowerCase().includes(q)
          : false;
        const matchesMsg = contact.message.toLowerCase().includes(q);
        if (
          !matchesName &&
          !matchesWa &&
          !matchesPhone &&
          !matchesEmail &&
          !matchesInst &&
          !matchesMsg
        ) {
          return false;
        }
      }
      return true;
    });
  }, [contacts, interestFilter, statusFilter, search]);

  const getInterestBadge = (interest: PitchInterest) => {
    switch (interest) {
      case "INVESTIDOR":
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-medium">
            <Coins className="w-3 h-3" />
            Investidor
          </Badge>
        );
      case "PARCEIRO":
        return (
          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 font-medium">
            <Building2 className="w-3 h-3" />
            Parceiro
          </Badge>
        );
      case "AMBOS":
        return (
          <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1 font-medium">
            <HeartHandshake className="w-3 h-3" />
            Investidor + Parceiro
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: PitchContactStatus) => {
    switch (status) {
      case "NOVO":
        return (
          <Badge
            variant="secondary"
            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          >
            Novo
          </Badge>
        );
      case "CONTACTADO":
        return (
          <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
            Contactado
          </Badge>
        );
      case "EM_ACOMPANHAMENTO":
        return (
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
            Em acompanhamento
          </Badge>
        );
      case "CONVERTIDO":
        return (
          <Badge variant="secondary" className="bg-emerald-600 text-white">
            Convertido
          </Badge>
        );
      case "ARQUIVADO":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Arquivado
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
            Relacionamentos & Pitch STS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão estratégica de interessados, potenciais investidores e parceiros captados no
            pitch.
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

          <Button
            variant="default"
            size="sm"
            onClick={() => exportPitchContactsToCsv(filteredContacts)}
            disabled={filteredContacts.length === 0}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
          >
            <Download className="w-4 h-4" />
            Exportar CSV ({filteredContacts.length})
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard
          title="Total Contatos"
          value={metrics.total}
          subtitle="Captados no pitch"
          icon={<Users className="w-4 h-4 text-primary" />}
        />
        <MetricCard
          title="Investidores"
          value={metrics.investors}
          subtitle="Interesse capital"
          icon={<Coins className="w-4 h-4 text-amber-500" />}
        />
        <MetricCard
          title="Parceiros"
          value={metrics.partners}
          subtitle="Empresas / Univ."
          icon={<Building2 className="w-4 h-4 text-blue-500" />}
        />
        <MetricCard
          title="Ambos"
          value={metrics.both}
          subtitle="Investidor + Parceiro"
          icon={<HeartHandshake className="w-4 h-4 text-purple-500" />}
        />
        <MetricCard
          title="Novos"
          value={metrics.newContacts}
          subtitle="Aguardando contato"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        />
        <MetricCard
          title="Em Acompanhamento"
          value={metrics.inFollowUp}
          subtitle="Em conversa"
          icon={<MessageSquare className="w-4 h-4 text-amber-500" />}
        />
        <MetricCard
          title="Convertidos"
          value={metrics.converted}
          subtitle="Parceria / Avance"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <Input
              placeholder="Buscar por nome, WhatsApp, e-mail, instituição ou mensagem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
            <div className="w-full sm:w-44">
              <Select value={interestFilter} onValueChange={setInterestFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Interesse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos Interesses</SelectItem>
                  <SelectItem value="INVESTIDOR">Investidores</SelectItem>
                  <SelectItem value="PARCEIRO">Parceiros</SelectItem>
                  <SelectItem value="AMBOS">Investidor + Parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos Status</SelectItem>
                  <SelectItem value="NOVO">Novo</SelectItem>
                  <SelectItem value="CONTACTADO">Contactado</SelectItem>
                  <SelectItem value="EM_ACOMPANHAMENTO">Em acompanhamento</SelectItem>
                  <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                  <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List / Cards */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse">
          Carregando contatos captados no pitch...
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <h3 className="font-semibold text-foreground">Nenhum contato encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Nenhum contato corresponde aos filtros selecionados. Novos formulários enviados na
              página do Pitch aparecerão automaticamente aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredContacts.map((contact) => {
            const cleanPhone = normalizePhoneNumber(contact.whatsapp);
            const waLink = `https://wa.me/55${cleanPhone}`;

            return (
              <Card
                key={contact.id}
                className="hover:border-amber-500/40 transition-colors duration-200"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info Column */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-foreground truncate">
                        {contact.name}
                      </span>
                      {getInterestBadge(contact.interest)}
                      {getStatusBadge(contact.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>WhatsApp: {contact.whatsapp}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      {contact.phone && !contact.same_phone_whatsapp && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          Ligação: {contact.phone}
                        </span>
                      )}

                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(contact.created_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    {/* Specific Partner / Investor snippet */}
                    {contact.institution_name && (
                      <div className="text-xs flex items-center gap-1.5 text-foreground/80 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Instituição: {contact.institution_name}</span>
                        {contact.institution_type && (
                          <span className="text-muted-foreground">
                            ({INSTITUTION_TYPE_LABELS[contact.institution_type]})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Preview */}
                    <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60 line-clamp-2">
                      <span className="font-semibold text-foreground">Mensagem:</span>{" "}
                      {contact.message}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                    <div className="w-40">
                      <Select
                        value={contact.status}
                        onValueChange={(val) =>
                          handleStatusChange(contact.id, val as PitchContactStatus)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NOVO">Novo</SelectItem>
                          <SelectItem value="CONTACTADO">Contactado</SelectItem>
                          <SelectItem value="EM_ACOMPANHAMENTO">Em acompanhamento</SelectItem>
                          <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                          <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                      >
                        <a href={waLink} target="_blank" rel="noreferrer">
                          <Phone className="w-3.5 h-3.5" />
                          Conversar
                        </a>
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenDetails(contact)}
                        className="h-8 text-xs gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Details & Team Notes Dialog */}
      <Dialog
        open={Boolean(selectedContact)}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      >
        {selectedContact && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                {getInterestBadge(selectedContact.interest)}
                {getStatusBadge(selectedContact.status)}
              </div>
              <DialogTitle className="text-xl font-bold">{selectedContact.name}</DialogTitle>
              <DialogDescription>
                Cadastrado em {new Date(selectedContact.created_at).toLocaleString("pt-BR")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Contact Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">
                    WhatsApp:
                  </span>
                  <a
                    href={`https://wa.me/55${normalizePhoneNumber(selectedContact.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-600 flex items-center gap-1 hover:underline"
                  >
                    {selectedContact.whatsapp}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Telefone para Ligação:
                  </span>
                  <span className="font-medium">
                    {selectedContact.same_phone_whatsapp
                      ? `${selectedContact.whatsapp} (mesmo do WhatsApp)`
                      : selectedContact.phone || "Não informado"}
                  </span>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">E-mail:</span>
                  <span className="font-medium">{selectedContact.email || "Não informado"}</span>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Origem do Cadastro:
                  </span>
                  <span className="font-medium">{selectedContact.source}</span>
                </div>
              </div>

              {/* Investor Details */}
              {(selectedContact.interest === "INVESTIDOR" ||
                selectedContact.interest === "AMBOS") && (
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    Interesse de Investidor
                  </h4>
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Preferência de Atualização:
                    </span>
                    <p className="font-medium text-foreground">
                      {selectedContact.investor_update_preference
                        ? INVESTOR_UPDATE_LABELS[selectedContact.investor_update_preference]
                        : "Não informado"}
                    </p>
                  </div>
                </div>
              )}

              {/* Partner Details */}
              {(selectedContact.interest === "PARCEIRO" ||
                selectedContact.interest === "AMBOS") && (
                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    Interesse de Parceria
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground block">Instituição:</span>
                      <p className="font-medium text-foreground">
                        {selectedContact.institution_name || "N/D"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Tipo:</span>
                      <p className="font-medium text-foreground">
                        {selectedContact.institution_type
                          ? INSTITUTION_TYPE_LABELS[selectedContact.institution_type]
                          : "N/D"}
                      </p>
                    </div>
                  </div>
                  {selectedContact.institution_address && (
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Endereço da Instituição:
                      </span>
                      <p className="font-medium text-foreground flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {selectedContact.institution_address}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Objetivo da Colaboração:
                    </span>
                    <p className="font-medium text-foreground">
                      {selectedContact.partnership_type
                        ? PARTNERSHIP_TYPE_LABELS[selectedContact.partnership_type]
                        : "N/D"}
                    </p>
                    {selectedContact.partnership_type === "OUTRO" &&
                      selectedContact.partnership_type_custom && (
                        <p className="text-xs italic text-muted-foreground mt-1">
                          "{selectedContact.partnership_type_custom}"
                        </p>
                      )}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Mensagem / Pergunta / Sugestão enviada:
                </span>
                <div className="p-3 bg-muted rounded-lg text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedContact.message}
                </div>
              </div>

              {/* Status Update in Dialog */}
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Status do Relacionamento:
                </span>
                <Select
                  value={selectedContact.status}
                  onValueChange={(val) =>
                    handleStatusChange(selectedContact.id, val as PitchContactStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOVO">Novo</SelectItem>
                    <SelectItem value="CONTACTADO">Contactado</SelectItem>
                    <SelectItem value="EM_ACOMPANHAMENTO">Em acompanhamento</SelectItem>
                    <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                    <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Internal Team Notes */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Anotações Internas da Equipe:
                  </span>
                </div>
                <Textarea
                  rows={3}
                  placeholder="Ex.: Ligamos no dia 07/10, agendada reunião com o pró-reitor na terça-feira..."
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setSelectedContact(null)}>
                Fechar
              </Button>
              <Button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
              >
                {isSavingNotes ? "Salvando..." : "Salvar Anotações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
