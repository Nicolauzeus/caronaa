import {
  describePickupDifference,
  formatPickupAt,
  matchClassificationLabels,
  type RideMatchEvaluation,
} from "@/lib/intelligent-match";

export function MatchOpportunityDetails({ fit }: { fit: RideMatchEvaluation }) {
  return (
    <div className="mt-3 space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
      <p className="font-bold text-primary">
        {fit.differenceMinutes == null
          ? "Oferta disponível"
          : matchClassificationLabels[fit.classification]}
      </p>
      <p>
        Embarque estimado: <strong>{formatPickupAt(fit.pickupAt)}</strong>
      </p>
      <p>{describePickupDifference(fit.differenceMinutes)}</p>
      {fit.pickupDistanceKm != null && (
        <p>
          Embarque a aproximadamente {Math.round(fit.pickupDistanceKm * 1000)} m do corredor da
          rota.
        </p>
      )}
      <p className="text-muted-foreground">
        {fit.roadGeometry
          ? "Previsão baseada no trajeto salvo, sem trânsito em tempo real."
          : "Trajeto aproximado; confirme o ponto de encontro e o acesso por estrada."}{" "}
        Ver esta sugestão não reserva vagas nem confirma a viagem.
      </p>
    </div>
  );
}
