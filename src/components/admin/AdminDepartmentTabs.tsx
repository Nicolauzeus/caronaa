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
  return (
    <section
      aria-label={"Navegação de " + department.name}
      className="min-w-0 border-b border-border/70 bg-background"
    >
      <nav
        aria-label={"Módulos de " + department.name}
        className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 md:px-5 [scrollbar-width:thin]"
      >
        {modules.map((module) => (
          <Link
            key={module.id}
            to={module.route}
            hash={module.id}
            activeOptions={{ exact: true, includeHash: true }}
            search={module.route === location.pathname ? (previous) => previous : undefined}
            aria-current={current?.id === module.id ? "page" : undefined}
            className={
              current?.id === module.id
                ? "shrink-0 whitespace-nowrap border-b-2 border-primary px-3 py-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            }
          >
            {module.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
