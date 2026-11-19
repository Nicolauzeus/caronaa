export type QuickRideCaseUpdate={
  ride_id:string;
  case_kind:"AWAITING_PASSENGER"|"NO_RESPONSE"|"DISPUTED"|"RESOLVED"|string;
  passenger_dispute_reason_code:string|null;
  passenger_dispute_note:string|null;
  admin_decision:string|null;
  admin_reason:string|null;
  admin_resolved_at:string|null;
  deadline_at:string|null;
};

const reasonLabels:Record<string,string>={
  DRIVER_ENDED_EARLY:"Motorista solicitou o encerramento antes do desembarque",
  WRONG_LOCATION:"Local de desembarque diferente do combinado",
  UNSAFE_STOP:"Parada em local inseguro",
  OTHER:"Outro problema",
};

export function quickRideCasesById(value:unknown):Record<string,QuickRideCaseUpdate>{
  if(!Array.isArray(value))return {};
  const result:Record<string,QuickRideCaseUpdate>={};
  for(const item of value){
    if(!item||typeof item!=="object")continue;
    const row=item as Partial<QuickRideCaseUpdate>;
    if(typeof row.ride_id!=="string"||!row.ride_id)continue;
    result[row.ride_id]={
      ride_id:row.ride_id,
      case_kind:typeof row.case_kind==="string"?row.case_kind:"AWAITING_PASSENGER",
      passenger_dispute_reason_code:row.passenger_dispute_reason_code??null,
      passenger_dispute_note:row.passenger_dispute_note??null,
      admin_decision:row.admin_decision??null,
      admin_reason:row.admin_reason??null,
      admin_resolved_at:row.admin_resolved_at??null,
      deadline_at:row.deadline_at??null,
    };
  }
  return result;
}

export function QuickRideCaseStatusCard({entry}:{entry:QuickRideCaseUpdate}){
  const title=entry.admin_decision==="COMPLETE"?"Encerramento confirmado pela administração":
    entry.admin_decision==="CANCEL"?"Corrida cancelada pela administração":
    entry.case_kind==="DISPUTED"?"Contestação em análise":
    entry.case_kind==="NO_RESPONSE"?"Prazo de confirmação encerrado sem resposta":
    "Aguardando confirmação de desembarque";
  const description=entry.admin_decision==="COMPLETE"
    ?"A corrida foi concluída por decisão administrativa. O pagamento não foi automaticamente confirmado.":
    entry.admin_decision==="CANCEL"
    ?"A plataforma decidiu cancelar a corrida. Nenhum pagamento foi automaticamente confirmado.":
    entry.case_kind==="DISPUTED"
    ?"O problema relatado foi registrado para análise. Não há cobrança Pix enquanto o caso estiver pendente.":
    entry.case_kind==="NO_RESPONSE"
    ?"O passageiro não respondeu no prazo inicial. Isso não é contestação nem confirmação de desembarque.":
    "O passageiro ainda pode responder, inclusive após voltar ao aplicativo.";

  const date=entry.admin_resolved_at?new Date(entry.admin_resolved_at):null;
  const at=date&&!Number.isNaN(date.getTime())?
    date.toLocaleString("pt-BR",{timeZone:"America/Fortaleza"}):null;
  return <section role="status" aria-label="Situação do desembarque"
    className="space-y-1 rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
    <p className="font-bold">{title}</p>
    <p className="opacity-85">{description}</p>
    {entry.passenger_dispute_reason_code&&<p>
      <strong>Motivo apresentado:</strong> {reasonLabels[entry.passenger_dispute_reason_code]??"Motivo registrado"}
    </p>}
    {entry.passenger_dispute_note&&<p className="break-words">
      <strong>Relato do passageiro:</strong> {entry.passenger_dispute_note}
    </p>}
    {entry.admin_reason&&<p className="break-words"><strong>Justificativa da decisão:</strong> {entry.admin_reason}</p>}
    {at&&<p className="text-xs opacity-70">Decisão registrada em {at}</p>}
  </section>;
}
