import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/migrations/0059_disable_retired_sts_ride_rpc.sql", "utf8");

describe("retirada do fluxo operacional do Siará Tech Summit", () => {
  it("revoga a RPC de leitura da submissão para clientes", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_sts_ride_seed\(\)/i);
    expect(migration).toMatch(/FROM PUBLIC, anon, authenticated/i);
  });

  it("revoga a RPC que publicava viagens a partir da submissão", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.publish_sts_ride\(uuid, text, jsonb\)/i,
    );
    expect(migration).not.toMatch(/DROP TABLE|DELETE FROM/i);
  });
});
