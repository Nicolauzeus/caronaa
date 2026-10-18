import { useNavigate, useRouterState } from "@tanstack/react-router";
import { normalizeModuleHash } from "@/lib/admin/module-navigation";

/** URL is the source of truth: browser back, reload and shared links preserve the selected section. */
export function useAdminModuleSection<T extends string>(
  hashSections: Record<string, T>,
  fallback: T,
) {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const navigate = useNavigate();
  const selected = hashSections[normalizeModuleHash(hash ?? "")] ?? fallback;
  const setSelected = (value: T) => {
    const key = Object.keys(hashSections).find((k) => hashSections[k] === value);
    if (key) void navigate({ hash: key, search: true });
  };
  return [selected, setSelected] as const;
}
