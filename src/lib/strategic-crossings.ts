import { supabase } from "@/integrations/supabase/client";

export type StrategicCrossings = {
  profilePainAndIntent: {
    profile: string;
    respondents: number;
    averagePainIntensity: number | null;
    averageIntent: number | null;
  }[];
  painIntent: {
    painCode: string;
    respondents: number;
    averageIntensity: number | null;
    averageIntent: number | null;
  }[];
  routesWithStrongPain: {
    origin: string;
    destination: string;
    strongPainRespondents: number;
    averagePainIntensity: number;
  }[];
  demandByTime: { timeWindow: string | null; respondents: number }[];
  supplyDemandByRoute: {
    origin: string;
    destination: string;
    timeWindow: string;
    requests: number;
    offers: number;
    requestGap: number;
    offerGap: number;
  }[];
  currentSpendBySegment: { profile: string; costRange: string | null; respondents: number }[];
  transportInterest: {
    transport: string | null;
    respondents: number;
    averageIntent: number | null;
  }[];
  conversionToCompletedRide: {
    profile: string;
    usersWithIntent: number;
    usersWithCompletedRide: number;
    conversionRate: number;
  }[];
};

export async function getStrategicCrossings(
  filters: { periodStart?: string; periodEnd?: string; source?: string; campaign?: string } = {},
) {
  const { data, error } = await supabase.rpc("get_strategic_crossings", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
  });
  if (error) throw new Error(`Unable to load strategic crossings: ${error.message}`);
  return data as StrategicCrossings;
}
