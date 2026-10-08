import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

export function buildStsRpcRepair() {
  const canonical = readFileSync(
    new URL("../drizzle/migrations/0037_sts_first_publication.sql", import.meta.url),
    "utf8",
  );
  const functions = canonical
    .slice(canonical.indexOf("CREATE FUNCTION public.get_sts_ride_seed"))
    .replaceAll("CREATE FUNCTION public.", "CREATE OR REPLACE FUNCTION public.");
  return `BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(74120392);
DO $repair$ BEGIN
  IF to_regclass('public.form_submission_account_links') IS NULL THEN
    RAISE EXCEPTION 'Apply migration 0035_form_account_activation before this repair';
  END IF;
  IF to_regclass('public.form_ride_publications') IS NULL THEN
    EXECUTE $canonical$${canonical}$canonical$;
  ELSE
    EXECUTE $functions$${functions}$functions$;
  END IF;
END $repair$;
NOTIFY pgrst, 'reload schema';
COMMIT;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sql = buildStsRpcRepair();
  if (process.argv.includes("--apply")) {
    if (!process.env.LOVABLE_DB_MIGRATION_URL)
      throw new Error(
        "Configure LOVABLE_DB_MIGRATION_URL com conexão administrativa; a chave pública não permite DDL.",
      );
    const db = postgres(process.env.LOVABLE_DB_MIGRATION_URL, { max: 1, connect_timeout: 10 });
    try {
      await db.unsafe(sql).simple();
      console.log("Estruturas STS reparadas e recarga do schema cache solicitada.");
    } finally {
      await db.end({ timeout: 5 });
    }
  } else {
    const output = process.argv[2] ?? "/tmp/caronaa-sts-rpc-repair.sql";
    writeFileSync(output, sql);
    console.log(`SQL canônico de reparo gerado em ${output}`);
  }
}
