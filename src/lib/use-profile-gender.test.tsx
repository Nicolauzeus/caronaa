import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ user: { id: "first" } as { id: string } | null, read: vi.fn() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: api.user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: api.read }) }) }) } }));
import { useProfileGender } from "./use-profile-gender";
beforeEach(() => { vi.clearAllMocks(); api.user = { id: "first" }; });
describe("Authenticated profile gender", () => {
 it("hides eligibility while loading and clears it immediately on sign-out", async () => {
  let resolve!: (value: unknown) => void;
  api.read.mockReturnValue(new Promise(done => { resolve = done; }));
  const { result, rerender } = renderHook(useProfileGender);
  expect(result.current).toBeNull();
  await act(async () => resolve({ data: { gender: "FEMININO" }, error: null }));
  expect(result.current).toBe("FEMININO");
  api.user = null; rerender(); expect(result.current).toBeNull();
 });
 it("never applies a late female-profile response to another account", async () => {
  let first!: (value: unknown) => void;
  api.read.mockReturnValueOnce(new Promise(done => { first = done; })).mockResolvedValueOnce({ data: { gender: "MASCULINO" }, error: null });
  const { result, rerender } = renderHook(useProfileGender);
  api.user = { id: "second" }; rerender(); expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).toBe("MASCULINO"));
  await act(async () => first({ data: { gender: "FEMININO" }, error: null }));
  expect(result.current).toBe("MASCULINO");
 });
});
