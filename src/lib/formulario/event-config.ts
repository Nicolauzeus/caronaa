export interface EventPresenceOption {
  value: string;
  label: string;
  description?: string;
}

export interface StsEventConfig {
  name: string;
  edition: string;
  datesDescription: string;
  startDate: string;
  endDate: string;
  locationName: string;
  defaultMeetingPoint: string;
  presenceOptions: EventPresenceOption[];
}

export const STS_2026_CONFIG: StsEventConfig = {
  name: "Siará Tech Summit",
  edition: "2026",
  datesDescription: "07 a 09 de outubro de 2026",
  startDate: "2026-10-07",
  endDate: "2026-10-09",
  locationName: "Centro de Eventos do Ceará",
  defaultMeetingPoint: "Centro de Eventos do Ceará",
  presenceOptions: [
    { value: "HOJE", label: "Apenas hoje" },
    { value: "DIA_07", label: "Dia 07 (Quarta-feira)" },
    { value: "DIA_08", label: "Dia 08 (Quinta-feira)" },
    { value: "DIA_09", label: "Dia 09 (Sexta-feira)" },
    { value: "TODOS_DIAS", label: "Nos 3 dias de evento" },
    { value: "SEMPRE_UNIFOR", label: "Sempre passo pela UNIFOR / Região" },
    { value: "OUTRO", label: "Outro período" },
  ],
};
