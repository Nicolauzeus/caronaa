export function canViewRideCounterpartProfile(input: {
  callerId: string;
  targetId: string;
  passengerId: string;
  driverId: string;
}): boolean {
  const { callerId, targetId, passengerId, driverId } = input;
  if (passengerId === driverId) return false;
  if (callerId === passengerId) return targetId === driverId;
  if (callerId === driverId) return targetId === passengerId;
  return false;
}
