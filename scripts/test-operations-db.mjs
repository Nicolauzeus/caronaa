import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Never read a deployment URL or connect to an existing cluster.
const root = fileURLToPath(new URL("../", import.meta.url));
const bin = process.env.POSTGRES_BIN ||
  ["/usr/lib/postgresql/18/bin", "/usr/lib/postgresql/17/bin"].find(p => existsSync(join(p,"initdb")));
if (!bin) throw new Error("Set POSTGRES_BIN to the PostgreSQL server binaries directory.");
if (process.getuid?.() === 0) throw new Error("Run as a normal user, not root.");
const dir = mkdtempSync(join(tmpdir(),"caronaa-operations-"));
const data = join(dir,"data");
const log = join(dir,"postgres.log");
const env = Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith("PG")));
const run = (name,args) => {
  const r=spawnSync(join(bin,name),args,{cwd:root,env,encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.error || r.status!==0) throw new Error(name+": "+(r.error?.message || r.stderr || r.stdout || r.status));
  return r;
};
const apply = (file) => {
  try {
    return run("psql",["-X","-h",dir,"-p","55433","-U",userInfo().username,"-d","postgres","-v","ON_ERROR_STOP=1","-f",join(root,file)]);
  } catch(e) { throw new Error(file+": "+e.message); }
};
let started=false;
try {
  run("initdb",["-D",data,"--auth=trust","--no-locale","--encoding=UTF8"]);
  try {
    run("pg_ctl",["-D",data,"-l",log,"-o",`-F -k "${dir}" -c listen_addresses='' -p 55433`,"-w","start"]);
  } catch(e) { throw new Error(e.message+"\n"+(existsSync(log)?readFileSync(log,"utf8"):"")); }
  started=true;
  apply("src/test/ride-security-db-bootstrap.sql");
  apply("src/test/operations-db-fixture.sql");
  const migrations=readdirSync(join(root,"drizzle/migrations")).filter(n=>/^0(247|248|249|250|251|252)_.*\.sql$/.test(n)).sort();
  if(migrations.length!==6 || new Set(migrations.map(n=>n.slice(0,4))).size!==6) throw new Error("Expected one migration per number 0247-0252.");
  for(const m of migrations) {
    apply("drizzle/migrations/"+m);
    console.log("APPLIED: "+m);
  }
  const r=apply("src/test/operations-db.integration.sql");
  const checks=r.stderr.split("\n").filter(l=>l.includes("PASS:"));
  for(const check of checks) console.log(check);
  if(checks.length!==9) throw new Error("Expected 9 integration check groups, got "+checks.length);
  console.log("PASS: 6 migrations and "+checks.length+" integration check groups in isolated PostgreSQL (minimal schema fixture).");
} finally {
  if(started) run("pg_ctl",["-D",data,"-m","fast","-w","stop"]);
  rmSync(dir,{recursive:true,force:true});
}
