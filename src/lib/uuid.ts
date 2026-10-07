import { z } from "zod";

export const uuidSchema = z.string().uuid();

export function createUuid(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") return uuidSchema.parse(crypto.randomUUID());
  if (typeof crypto?.getRandomValues !== "function") {
    throw new Error(
      "Este navegador não oferece geração segura de UUID. Use um navegador atualizado.",
    );
  }
  // randomUUID requires a secure context; getRandomValues also supports older HTTP previews.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return uuidSchema.parse(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
  );
}

export function ensureUuid(value: unknown): string {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : createUuid();
}
