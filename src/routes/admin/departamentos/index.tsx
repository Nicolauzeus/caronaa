import {createFileRoute,Link} from "@tanstack/react-router";
import {ArrowUpRight} from "lucide-react";
import {DEPARTMENTS} from "@/lib/admin/departments";
import {getDepartmentHome} from "@/lib/admin/module-navigation";

export const Route=createFileRoute("/admin/departamentos/")({component:DepartmentsIndex});
function DepartmentsIndex(){
 return <main className="mx-auto max-w-5xl space-y-5">
  <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">CARONAA Enterprise</p><h1 className="mt-2 text-3xl font-extrabold">Departamentos</h1><p className="mt-2 text-sm text-muted-foreground">Escolha sua área de trabalho. As funcionalidades ficam nas abas da página, sem uma segunda etapa de cards.</p></header>
  <nav aria-label="Departamentos da empresa" className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
   {DEPARTMENTS.map((department,i)=><Link to={getDepartmentHome(department.id)} key={department.id}
    className="group flex min-h-16 items-center gap-4 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-accent/50 focus-visible:bg-accent">
    <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{String(i+1).padStart(2,"0")}</span>
    <div className="min-w-0 flex-1"><p className="font-semibold group-hover:text-primary">{department.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{department.mission}</p></div>
    <ArrowUpRight size={17} aria-hidden="true" className="shrink-0 text-muted-foreground group-hover:text-primary"/>
   </Link>)}
  </nav>
 </main>
}
