import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight, Bike, Camera, CarFront, CheckCircle2, ChevronRight,
  IdCard, MapPin, Pencil, Settings2, ShieldCheck, Wallet,
} from "lucide-react";
import { DriverWhatsAppSupport } from "./DriverWhatsAppSupport";
import "./professional-account.css";

type DriverAccountProps = {
  name: string;
  initials: string;
  photo: string | null;
  city: string;
  isMoto: boolean;
  authorized: boolean;
  vehicleBrand: string;
  vehicleDescription: string;
  vehiclePlate: string;
  whatsapp: string;
  onEditPhoto: () => void;
  driverForm: ReactNode;
  vehicleForm: ReactNode;
  vehicleFormManaged?: boolean;
  financeContent: ReactNode;
  settingsContent: ReactNode;
  onSave: () => void;
  saving: boolean;
};

type PanelId = "driver" | "vehicle" | "finance" | "settings";
const fallback = (value: string) => value.trim() || "Não informado";

export function ProfessionalAccountDashboard(props: DriverAccountProps) {
  const {
    name, initials, photo, city, isMoto, authorized,
    vehicleBrand, vehicleDescription, vehiclePlate, whatsapp,
    onEditPhoto, driverForm, vehicleForm, vehicleFormManaged, financeContent, settingsContent, onSave, saving,
  } = props;
  const [expanded, setExpanded] = useState<PanelId | null>(() =>
    typeof window !== "undefined" && window.location.hash === "#pix-do-motorista" ? "finance" : null
  );
  const driverCard = useRef<HTMLDivElement>(null);

  function openEditDriver() {
    setExpanded("driver");
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      driverCard.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  function toggle(id: PanelId) {
    setExpanded(previous => previous === id ? null : id);
  }

  const vehicleLabel = isMoto ? "Dados da Moto" : "Dados do Carro";
  const VehicleIcon = isMoto ? Bike : CarFront;

  return (
    <div className="driver-account dark">
      <header className="driver-account__heading">
        <p>CARONAA MOTORISTA</p>
        <h1>Meu Perfil</h1>
        <span>Gerencie seus dados, veículo, recebimentos e configurações da sua conta.</span>
      </header>

      <section className={`driver-account__hero ${isMoto ? "driver-account__hero--moto" : "driver-account__hero--carro"}`} aria-label="Identificação do motorista">
        <div className="driver-account__hero-row">
          <div className="driver-account__avatar">
            <button type="button" onClick={onEditPhoto} className="driver-account__avatar-button" aria-label="Alterar foto de perfil">
              {photo
                ? <img src={photo} alt="Foto de perfil" width={112} height={112} className="driver-account__avatar-image"/>
                : <span aria-label="Sem foto cadastrada" className="driver-account__initials">{initials}</span>}
            </button>
            <button type="button" className="driver-account__camera" onClick={onEditPhoto} aria-label="Escolher ou tirar foto">
              <Camera size={17} aria-hidden="true"/>
            </button>
          </div>
          <div className="driver-account__identity">
            <h2>{fallback(name)}</h2>
            <p><MapPin size={15} aria-hidden="true"/> {isMoto ? "Mototaxista" : "Motorista"}{city ? ` · ${city}` : ""}</p>
            <span className={`driver-account__approval ${authorized ? "driver-account__approval--granted" : ""}`}>
              {authorized ? <CheckCircle2 size={16} aria-hidden="true"/> : <ShieldCheck size={16} aria-hidden="true"/>}
              {authorized ? "Acesso profissional autorizado" : "Acesso ainda não autorizado"}
            </span>
          </div>
        </div>
        <div className="driver-account__hero-actions">
          <button type="button" onClick={openEditDriver} className="driver-account__action-primary">
            <Pencil size={18} aria-hidden="true"/> Editar meus dados
          </button>
          <Link className="driver-account__action-outline" to={authorized ? "/disponibilidade-profissional" : "/cadastro-motorista"}>
            <ArrowRight size={18} aria-hidden="true"/>
            {authorized ? "Acessar Cockpit" : "Consultar cadastro"}
          </Link>
        </div>
      </section>

      <section aria-label="Seções da conta" className="driver-account__grid">
        <div className="driver-account__card" ref={driverCard} id="profile-driver-data">
          <button type="button" className="driver-account__card-trigger" onClick={() => toggle("driver")} aria-expanded={expanded==="driver"} aria-controls="driver-account-driver-edit">
            <IdCard size={25} className="driver-account__card-icon" aria-hidden="true"/>
            <span className="driver-account__card-header"><strong>Dados do Condutor</strong><small>Nome, WhatsApp e município</small></span>
            <ChevronRight size={21} className={expanded==="driver" ? "driver-account__chevron--open" : ""} aria-hidden="true"/>
          </button>
          <dl className="driver-account__preview">
            <div><dt>Nome completo</dt><dd>{fallback(name)}</dd></div>
            <div><dt>WhatsApp</dt><dd>{fallback(whatsapp)}</dd></div>
            <div><dt>Cidade cadastrada</dt><dd>{fallback(city)}</dd></div>
          </dl>
          {expanded === "driver" && <div id="driver-account-driver-edit" className="driver-account__expanded">
            <h3>Editar dados do condutor</h3>
            {driverForm}
            {!vehicleFormManaged&&<button type="button" className="driver-account__save" onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>}
          </div>}
        </div>

        <div className="driver-account__card">
          <button type="button" className="driver-account__card-trigger" onClick={() => toggle("vehicle")} aria-expanded={expanded==="vehicle"} aria-controls="driver-account-vehicle-edit">
            <VehicleIcon size={25} className="driver-account__card-icon" aria-hidden="true"/>
            <span className="driver-account__card-header"><strong>{vehicleLabel}</strong><small>Informações do seu veículo</small></span>
            <ChevronRight size={21} className={expanded==="vehicle" ? "driver-account__chevron--open" : ""} aria-hidden="true"/>
          </button>
          <dl className="driver-account__preview">
            <div><dt>Marca</dt><dd>{fallback(vehicleBrand)}</dd></div>
            <div><dt>Modelo e cor</dt><dd>{fallback(vehicleDescription)}</dd></div>
            <div><dt>Placa</dt><dd>{fallback(vehiclePlate)}</dd></div>
          </dl>
          {expanded === "vehicle" && <div id="driver-account-vehicle-edit" className="driver-account__expanded">
            <h3>Gerenciar veículos</h3>
            {vehicleForm}
            <button type="button" className="driver-account__save" onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>}
        </div>

        <div className="driver-account__card">
          <button type="button" className="driver-account__card-trigger" onClick={() => toggle("finance")} aria-expanded={expanded==="finance"} aria-controls="driver-account-finance">
            <Wallet size={25} className="driver-account__card-icon" aria-hidden="true"/>
            <span className="driver-account__card-header"><strong>Financeiro</strong><small>Recebimentos e comissões</small></span>
            <ChevronRight size={21} className={expanded==="finance" ? "driver-account__chevron--open" : ""} aria-hidden="true"/>
          </button>
          <div className="driver-account__summary-lines"><span>Chave Pix</span><strong>Consultar recebimentos</strong><span>Comissões da plataforma</span><strong>Consultar situação financeira</strong></div>
          {expanded === "finance" && <div id="driver-account-finance" className="driver-account__expanded">
            {financeContent}
          </div>}
        </div>

        <div className="driver-account__card">
          <button type="button" className="driver-account__card-trigger" onClick={() => toggle("settings")} aria-expanded={expanded==="settings"} aria-controls="driver-account-settings">
            <Settings2 size={25} className="driver-account__card-icon" aria-hidden="true"/>
            <span className="driver-account__card-header"><strong>Configurações</strong><small>Notificações, segurança e vínculos</small></span>
            <ChevronRight size={21} className={expanded==="settings" ? "driver-account__chevron--open" : ""} aria-hidden="true"/>
          </button>
          <div className="driver-account__summary-lines"><span>Notificações</span><strong>Avisos e sons</strong><span>Vínculos e verificações</span><strong>Informações adicionais</strong></div>
          {expanded === "settings" && <div id="driver-account-settings" className="driver-account__expanded">
            {settingsContent}
          </div>}
        </div>
      </section>

      <DriverWhatsAppSupport />
    </div>
  );
}
