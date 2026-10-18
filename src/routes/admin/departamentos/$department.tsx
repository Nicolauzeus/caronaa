import {createFileRoute,Link} from "@tanstack/react-router";
import {getDepartment} from "@/lib/admin/departments";
import {getDepartmentHome} from "@/lib/admin/module-navigation";
import {AdminDepartmentTabs} from "@/components/admin/AdminDepartmentTabs";
export const Route=createFileRoute("/admin/departamentos/$department")({component:DepartmentPage});
function DepartmentPage(){
 const {department:id}=Route.useParams();
 const item=getDepartment(id);
 if(!item)return <main className="space-y-3"><h1 className="text-2xl font-bold">Departamento não encontrado</h1><Link to="/admin/departamentos" className="text-primary">Ver departamentos</Link></main>;
 return <main className="space-y-5">
  <Link to="/admin/departamentos" className="text-sm text-muted-foreground hover:text-primary">← Departamentos</Link>
  <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">CARONAA Enterprise</p><h1 className="mt-2 text-3xl font-extrabold">{item.name}</h1><p className="mt-2 text-sm text-muted-foreground">{item.mission}</p></header>
  <AdminDepartmentTabs departmentId={item.id}/>
  <p className="text-sm text-muted-foreground">Selecione uma aba para abrir a funcionalidade diretamente, sem passar por uma grade de cartões.</p>
  <Link to={getDepartmentHome(item.id)} className="inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Ir para visão principal →</Link>
  {item.categories.some(c=>c.phase==="planned")&&<details className="rounded-lg border border-border/60 px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Funcionalidades em evolução</summary><ul className="mt-3 space-y-2 text-muted-foreground">{item.categories.filter(c=>c.phase==="planned").map(c=><li key={c.id}>{c.label} — {c.description}</li>)}</ul></details>}
 </main>;
}
