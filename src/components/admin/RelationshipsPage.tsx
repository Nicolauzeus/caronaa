import { SavedAnswers } from "@/components/admin/SavedAnswers";
import { ListPagination } from "@/components/admin/ListPagination";
// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import {
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  ExternalLink,
  Eye,
  HeartHandshake,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  PitchContactFormData,
  PitchContactStatus,
  PitchInterest,
} from "@/lib/pitch/types";
import {
  exportPitchContactsToCsv,
  getPitchContacts,
  normalizePhoneNumber,
  savePitchContact,
  updatePitchContactNotes,
  updatePitchContactStatus,
} from "@/lib/pitch/pitch-service";
import { cn } from "@/lib/utils";

export function AdminRelacionamentosPage() {
  const [page, setPage] = useState(0);
  const [contacts, setContacts] = useState<PitchContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState<string>("TODOS");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");

  // Selected contact for detail modal & notes
  const [selectedContact, setSelectedContact] = useState<PitchContact | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // New manual contact creation dialog
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isSavingNewContact, setIsSavingNewContact] = useState(false);
  const [newContactForm, setNewContactForm] = useState<PitchContactFormData>({
    interest: "PARCEIRO",
    name: "",
    whatsapp: "",
    phone: "",
    same_phone_whatsapp: true,
    email: "",
    institution_name: "",
    institution_type: "EMPRESA",
    institution_address: "",
    partnership_type: "TESTAR_INSTITUICAO",
    investor_update_preference: "DURANTE_VALIDACAO",
    message: "",
    consent_contact: false,
    consent_newsletter: false,
  });

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await getPitchContacts();
      setContacts(res.data || []);
      setLoadError(res.error || null);
    } catch {
      toast.error("Erro ao carregar contatos de relacionamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContacts();
  }, []);

  const handleStatusChange = async (id: string, newStatus: PitchContactStatus) => {
    const previousStatus = contacts.find((contact) => contact.id === id)?.status;
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
    if (selectedContact && selectedContact.id === id) {
      setSelectedContact((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const result = await updatePitchContactStatus(id, newStatus);
      if (!result.success) throw new Error(result.error);
      toast.success(`Status atualizado para "${CONTACT_STATUS_LABELS[newStatus]}"`);
    } catch {
      if (previousStatus) {
        setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: previousStatus } : c)));
        if (selectedContact?.id === id) {
          setSelectedContact((prev) => (prev ? { ...prev, status: previousStatus } : null));
        }
      }
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
      const result = await updatePitchContactNotes(selectedContact.id, editingNotes);
      if (!result.success) throw new Error(result.error);
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

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactForm.name.trim() || !newContactForm.whatsapp.trim()) {
      toast.error("Informe pelo menos o nome e o WhatsApp do contato.");
      return;
    }

    try {
      setIsSavingNewContact(true);
      const res = await savePitchContact({
        ...newContactForm,
        source: "admin_manual",
        message: newContactForm.message.trim() || "Contato cadastrado manualmente no painel administrativo.",
      });

      if (res.success && res.data) {
        toast.success("Contato cadastrado com sucesso!");
        setIsNewContactOpen(false);
        setNewContactForm({
          interest: "PARCEIRO",
          name: "",
          whatsapp: "",
          phone: "",
          same_phone_whatsapp: true,
          email: "",
          institution_name: "",
          institution_type: "EMPRESA",
          institution_address: "",
          partnership_type: "TESTAR_INSTITUICAO",
          investor_update_preference: "DURANTE_VALIDACAO",
          message: "",
          consent_contact: false,
          consent_newsletter: false,
        });
        await fetchContacts();
      } else {
        toast.error("Não foi possível salvar o contato.");
      }
    } catch {
      toast.error("Erro ao cadastrar contato.");
    } finally {
      setIsSavingNewContact(false);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const list = contacts || [];
    const total = list.length;
    const investors = list.filter((c) => c.interest === "INVESTIDOR").length;
    const partners = list.filter((c) => c.interest === "PARCEIRO").length;
    const both = list.filter((c) => c.interest === "AMBOS").length;
    const newContacts = list.filter((c) => c.status === "NOVO").length;
    const inFollowUp = list.filter((c) => c.status === "EM_ACOMPANHAMENTO").length;
    const converted = list.filter((c) => c.status === "CONVERTIDO").length;

    return { total, investors, partners, both, newContacts, inFollowUp, converted };
  }, [contacts]);

  // Filtered contacts list with defensive checks
  const filteredContacts = useMemo(() => {
    const list = contacts || [];
    return list.filter((contact) => {
      if (!contact) return false;
      if (interestFilter !== "TODOS" && contact.interest !== interestFilter) {
        return false;
      }
      if (statusFilter !== "TODOS" && contact.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (contact.name || "").toLowerCase();
        const wa = contact.whatsapp || "";
        const phone = contact.phone || "";
        const email = (contact.email || "").toLowerCase();
        const inst = (contact.institution_name || "").toLowerCase();
        const msg = (contact.message || "").toLowerCase();

        if (
          !name.includes(q) &&
          !wa.includes(q) &&
          !phone.includes(q) &&
          !email.includes(q) &&
          !inst.includes(q) &&
          !msg.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [contacts, interestFilter, statusFilter, search]);

  useEffect(() => setPage(0), [filteredContacts]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filteredContacts.length / 8) - 1));
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
      default:
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
      default:
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsNewContactOpen(true)}
            className="gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="w-4 h-4" />
            Novo Contato
          </Button>

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
            variant="secondary"
            size="sm"
            onClick={() => exportPitchContactsToCsv(filteredContacts)}
            disabled={filteredContacts.length === 0}
            className="gap-2 font-medium"
          >
            <Download className="w-4 h-4" />
            Exportar CSV ({filteredContacts.length})
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard
          label="Total Contatos"
          value={String(metrics.total)}
          detail="Captados no pitch"
        />
        <MetricCard
          label="Investidores"
          value={String(metrics.investors)}
          detail="Interesse capital"
        />
        <MetricCard
          label="Parceiros"
          value={String(metrics.partners)}
          detail="Empresas / Univ."
        />
        <MetricCard
          label="Ambos"
          value={String(metrics.both)}
          detail="Investidor + Parceiro"
        />
        <MetricCard
          label="Novos"
          value={String(metrics.newContacts)}
          detail="Aguardando contato"
        />
        <MetricCard
          label="Em Acompanhamento"
          value={String(metrics.inFollowUp)}
          detail="Em conversa"
        />
        <MetricCard
          label="Convertidos"
          value={String(metrics.converted)}
          detail="Parceria / Avance"
        />
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Dados do servidor indisponíveis</p>
            <p className="mt-1">{loadError} Os dados locais exibidos podem estar desatualizados.</p>
          </div>
        </div>
      )}

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
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
        <div className="p-12 text-center text-muted-foreground animate-pulse rounded-xl border border-border bg-card">
          Carregando contatos de relacionamento...
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <h3 className="font-semibold text-foreground">Nenhum contato encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Nenhum contato corresponde aos filtros selecionados. Novos formulários enviados na
              página do Pitch ou cadastrados manualmente aparecerão aqui.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              {(search || interestFilter !== "TODOS" || statusFilter !== "TODOS") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setInterestFilter("TODOS");
                    setStatusFilter("TODOS");
                  }}
                >
                  Limpar Filtros
                </Button>
              )}
              <Button size="sm" onClick={() => setIsNewContactOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Cadastrar Contato
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredContacts.slice(currentPage * 8, (currentPage + 1) * 8).map((contact) => {
            const cleanPhone = normalizePhoneNumber(contact.whatsapp || "");
            const waLink = `https://wa.me/55${cleanPhone}`;

            return (
              <Card
                key={contact.id}
                className="hover:border-primary/40 transition-colors duration-200"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info Column */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-foreground truncate">
                        {contact.name || "Sem nome"}
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
                        {contact.created_at
                          ? new Date(contact.created_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "Data não informada"}
                      </span>
                    </div>

                    {/* Specific Partner / Investor snippet */}
                    {contact.institution_name && (
                      <div className="text-xs flex items-center gap-1.5 text-foreground/80 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Instituição: {contact.institution_name}</span>
                        {contact.institution_type && (
                          <span className="text-muted-foreground">
                            ({INSTITUTION_TYPE_LABELS[contact.institution_type] || contact.institution_type})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Preview */}
                    <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60 line-clamp-2">
                      <span className="font-semibold text-foreground">Mensagem:</span>{" "}
                      {contact.message || "Sem mensagem"}
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

      <ListPagination page={currentPage} total={filteredContacts.length} pageSize={8} onChange={setPage} />
      {/* Dialog: Create Manual Contact */}
      <Dialog open={isNewContactOpen} onOpenChange={setIsNewContactOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateContact}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Cadastrar Novo Contato</DialogTitle>
              <DialogDescription>
                Adicione um potencial parceiro ou investidor captado presencialmente ou por outros canais.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Nome completo *</Label>
                <Input
                  id="contact-name"
                  required
                  placeholder="Ex.: Mariana Costa"
                  value={newContactForm.name}
                  onChange={(e) =>
                    setNewContactForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-wa">WhatsApp com DDD *</Label>
                  <Input
                    id="contact-wa"
                    required
                    placeholder="(85) 99999-9999"
                    value={newContactForm.whatsapp}
                    onChange={(e) =>
                      setNewContactForm((prev) => ({ ...prev, whatsapp: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">E-mail (opcional)</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="mariana@empresa.com"
                    value={newContactForm.email || ""}
                    onChange={(e) =>
                      setNewContactForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
              </div>

              {(newContactForm.interest === "INVESTIDOR" || newContactForm.interest === "AMBOS") && (
                <div className="space-y-1.5">
                  <Label>Preferência de atualização do investidor</Label>
                  <Select
                    value={newContactForm.investor_update_preference || ""}
                    onValueChange={(val) =>
                      setNewContactForm((prev) => ({
                        ...prev,
                        investor_update_preference: val as PitchContactFormData["investor_update_preference"],
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione uma preferência" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVESTOR_UPDATE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(newContactForm.interest === "PARCEIRO" || newContactForm.interest === "AMBOS") && (
                <>
                  <div className="space-y-1.5">
                    <Label>Objetivo da parceria</Label>
                    <Select
                      value={newContactForm.partnership_type || ""}
                      onValueChange={(val) =>
                        setNewContactForm((prev) => ({
                          ...prev,
                          partnership_type: val as PitchContactFormData["partnership_type"],
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o interesse de parceria" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PARTNERSHIP_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newContactForm.partnership_type === "OUTRO" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-partnership-custom">Outro objetivo</Label>
                      <Input
                        id="contact-partnership-custom"
                        value={newContactForm.partnership_type_custom || ""}
                        onChange={(event) =>
                          setNewContactForm((prev) => ({ ...prev, partnership_type_custom: event.target.value }))
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-address">Endereço da instituição (opcional)</Label>
                    <Input
                      id="contact-address"
                      value={newContactForm.institution_address || ""}
                      onChange={(event) =>
                        setNewContactForm((prev) => ({ ...prev, institution_address: event.target.value }))
                      }
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label>Tipo de Interesse</Label>
                <Select
                  value={newContactForm.interest}
                  onValueChange={(val) =>
                    setNewContactForm((prev) => ({ ...prev, interest: val as PitchInterest }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARCEIRO">Parceiro (Empresa / Universidade)</SelectItem>
                    <SelectItem value="INVESTIDOR">Investidor</SelectItem>
                    <SelectItem value="AMBOS">Investidor + Parceiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newContactForm.consent_contact}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, consent_contact: event.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>O contato autorizou que a equipe fale com ele sobre esta conversa.</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newContactForm.consent_newsletter}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, consent_newsletter: event.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>O contato autorizou receber atualizações da CARONAA.</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-institution">Instituição / Empresa</Label>
                  <Input
                    id="contact-institution"
                    placeholder="Ex.: Grupo M. Dias Branco"
                    value={newContactForm.institution_name || ""}
                    onChange={(e) =>
                      setNewContactForm((prev) => ({
                        ...prev,
                        institution_name: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Tipo da Instituição</Label>
                  <Select
                    value={newContactForm.institution_type || "EMPRESA"}
                    onValueChange={(val) =>
                      setNewContactForm((prev) => ({ ...prev, institution_type: val as PitchContactFormData["institution_type"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPRESA">Empresa</SelectItem>
                      <SelectItem value="UNIVERSIDADE">Universidade</SelectItem>
                      <SelectItem value="INSTITUICAO">Instituição Pública</SelectItem>
                      <SelectItem value="COMUNIDADE">Comunidade / Hub</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-msg">Anotações / Contexto da Conversa</Label>
                <Textarea
                  id="contact-msg"
                  rows={3}
                  placeholder="Detalhes sobre a conversa, necessidades de mobilidade ou proposta de parceria..."
                  value={newContactForm.message}
                  onChange={(e) =>
                    setNewContactForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewContactOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingNewContact}>
                {isSavingNewContact ? "Salvando..." : "Salvar Contato"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                Cadastrado em{" "}
                {selectedContact.created_at
                  ? new Date(selectedContact.created_at).toLocaleString("pt-BR")
                  : "Data não informada"}
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
                    href={`https://wa.me/55${normalizePhoneNumber(selectedContact.whatsapp || "")}`}
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
                  <span className="font-medium">{selectedContact.source || "Pitch STS"}</span>
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
                        ? INVESTOR_UPDATE_LABELS[selectedContact.investor_update_preference] ||
                          selectedContact.investor_update_preference
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
                          ? INSTITUTION_TYPE_LABELS[selectedContact.institution_type] ||
                            selectedContact.institution_type
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
                        ? PARTNERSHIP_TYPE_LABELS[selectedContact.partnership_type] ||
                          selectedContact.partnership_type
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
                  {selectedContact.message || "Sem mensagem"}
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

              <section className="space-y-3 border-t border-border pt-3"><h3 className="font-semibold">Autorizações</h3><p>Contato: {selectedContact.consent_contact ? "Autorizado" : "Não autorizado"}</p><p>Atualizações: {selectedContact.consent_newsletter ? "Autorizadas" : "Não autorizadas"}</p></section>
              <details className="border-t border-border pt-3"><summary className="cursor-pointer font-semibold">Respostas completas do cadastro</summary><div className="mt-3"><SavedAnswers value={selectedContact.raw_payload}/></div></details>
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
                className="bg-primary text-primary-foreground font-semibold"
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
