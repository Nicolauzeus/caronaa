import { memo } from "react";
import { GoogleHomeRideMap } from "./GoogleHomeRideMap";
import type { UserPosition } from "@/lib/location/use-user-location";

type Point = { lat?: number; lng?: number };
export type ApproximateProfessionalDriver = {
  driver_key: string;
  lat: number;
  lng: number;
  seen_at: string;
};
type Props = {
  immersive?: boolean;
  userPosition: UserPosition | null;
  professionalDrivers?: ApproximateProfessionalDriver[];
  origin?: Point;
  destination?: Point;
  originIsCurrent: boolean;
  following: boolean;
  recenterVersion: number;
  locating: boolean;
  onDrag: () => void;
  onRecenter: () => void;
};

export const HomeRideMap = memo(function HomeRideMap(props: Props) {
  return <GoogleHomeRideMap {...props} />;
});
