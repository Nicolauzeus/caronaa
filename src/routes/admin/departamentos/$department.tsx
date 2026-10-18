import {createFileRoute,Link} from "@tanstack/react-router";
import {getDepartment} from "@/lib/admin/departments";
export const Route=createFileRoute("/admin/departamentos/$department")({component:DepartmentPage});
function DepartmentPage(){
 const {department:id}=Route.useParams();
 const item=getDepartment(id);
 if(!item)return <main className="space-y-3"><h1 className="text-2xl font-bold">Departamento não encontrado</h1><Link to="/admin/departamentos" className="text-primary">Voltar aos departamentos</Link></main>;
 return <main className="space-y-6">
 <Link to="/admin/departamentos" className="text-sm font-semibold text-primary">← Todos os departamentos</Link>
 <header className="rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-widest text-primary">CARONAA Enterprise · {item.shortName}</p><h1 className="mt-2 text-3xl font-extrabold">{item.name}</h1><p className="mt-2 text-sm text-muted-foreground">{item.mission}</p><p className="mt-3 text-xs text-muted-foreground">Área responsável: {item.ownerRole}</p></header>
 <section aria-label="Categorias do departamento" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{item.categories.map(c=><article key={c.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4"><div className="flex justify-between gap-2"><h2 className="font-bold">{c.label}</h2><span className="text-xs text-muted-foreground">{c.phase==="existing"?"Integrado":"Planejado"}</span></div><p className="flex-1 text-sm text-muted-foreground">{c.description}</p>{c.route?<Link to={c.route} className="mt-2 rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground">Abrir módulo →</Link>:<p className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">Ainda não implementado · sem dados fictícios</p>}</article>)}</section>
 <p className="text-xs text-muted-foreground">A organização por departamento não altera as permissões atuais. O acesso permanece sujeito ao AdminGuard e às políticas de dados existentes.</p>
 </main>;
}
