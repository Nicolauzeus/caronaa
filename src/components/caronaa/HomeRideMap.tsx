import type { StrictPickupPreview } from "@/lib/safe-pickup";
import { memo } from "react";
import { GoogleHomeRideMap } from "./GoogleHomeRideMap";
import type { UserPosition } from "@/lib/location/use-user-location";

type Point = { lat?: number; lng?: number };
export type ApproximateProfessionalDriver = {
  driver_key: string;
  lat: number;
  lng: number;
  seen_at: string;
  is_self?: boolean;
  simulated?: boolean;
};
type Props = {
  pickupPreview?: StrictPickupPreview | null;
  immersive?: boolean;
  userPosition: UserPosition | null;
  professionalDrivers?: ApproximateProfessionalDriver[];
  origin?: Point;
  destination?: Point;
  originIsCurrent: boolean;
  /** Accuracy of the GPS fix actually applied as the origin (may differ from live GPS). */
  originAccuracyM?: number | null;
  following: boolean;
  recenterVersion: number;
  locating: boolean;
  onDrag: () => void;
  onRecenter: () => void;
  selectingOrigin?: boolean;
  onPickOrigin?: (point: { lat: number; lng: number }) => void;
};

export const HomeRideMap = memo(function HomeRideMap(props: Props) {
  return <GoogleHomeRideMap {...props} />;
});
