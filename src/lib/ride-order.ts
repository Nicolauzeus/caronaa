type EditablePublication = { updatedAt: string; createdAt: string };

export function compareRideRecency<T extends EditablePublication>(a: T, b: T): number {
  return b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt);
}
