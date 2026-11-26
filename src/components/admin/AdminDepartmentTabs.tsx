import { Radio, Route as RouteIcon, UsersRound, FileBarChart, ChartNoAxesCombined, Settings2 } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { DEPARTMENTS, type DepartmentId } from "@/lib/admin/departments";
import { findActiveModule, getDepartmentOfPath, getModules } from "@/lib/admin/module-navigation";

/** Inline navigation, not a grid of duplicate redirect cards. */
export function AdminDepartmentTabs({ departmentId }: { departmentId?: DepartmentId }) {
  const location = useRouterState({ select: (s) => s.location });
  const id = departmentId ?? getDepartmentOfPath(location.pathname);
  if (!id) return null;
  const department = DEPARTMENTS.find((d) => d.id === id);
  const modules = getModules(id);
  if (!department || !modules.length) return null;
  const current = findActiveModule(id, location.pathname.replace(/\/$/, ""), location.hash ?? "");
  const operationsIcons = {command:Radio,journeys:RouteIcon,people:UsersRound,history:FileBarChart,intelligence:ChartNoAxesCombined,support:Settings2} as const;
  return (
    <section
      aria-label={"Navegação de " + department.name}
      className={id==="operations"?"min-w-0 border-b border-border/70 bg-background py-2":"min-w-0 border-b border-border/70 bg-background"}
    >
      <nav
        aria-label={"Módulos de " + department.name}
        className={id==="operations"?"grid grid-cols-3 gap-1.5 sm:grid-cols-6 md:px-3":"flex max-w-full gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 md:px-5 [scrollbar-width:thin]"}
      >
        {modules.map((module) => {
          const Icon=id==="operations"?operationsIcons[module.id as keyof typeof operationsIcons]:undefined;
          const active=current?.id===module.id;
          return <Link
            key={module.id}
            to={module.route}
            hash={module.id}
            activeOptions={{ exact: true, includeHash: true }}
            search={module.route === location.pathname ? (previous) => previous : undefined}
            aria-current={current?.id === module.id ? "page" : undefined}
            className={
              id==="operations"?("flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary sm:text-xs "+(active?"bg-[#FFBB00] text-[#121212]":"border border-transparent bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground")):
              current?.id === module.id
                ? "shrink-0 whitespace-nowrap border-b-2 border-primary px-3 py-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            }
          >
            {Icon&&<Icon size={17} aria-hidden="true"/>}
            <span className={id==="operations"?"max-w-full break-words":undefined}>{module.label}</span>
          </Link>;
        })}
      </nav>
    </section>
  );
}
