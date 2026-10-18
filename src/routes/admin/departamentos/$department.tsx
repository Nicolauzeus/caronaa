import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getDepartment } from "@/lib/admin/departments";
import { getDepartmentHome } from "@/lib/admin/module-navigation";
export const Route = createFileRoute("/admin/departamentos/$department")({
  beforeLoad: ({ params }) => {
    const department = getDepartment(params.department);
    if (department) throw redirect({ to: getDepartmentHome(department.id), replace: true });
  },
  component: DepartmentPage,
});
function DepartmentPage() {
  const { department: id } = Route.useParams();
  const item = getDepartment(id);
  if (!item)
    return (
      <main className="space-y-3">
        <h1 className="text-2xl font-bold">Departamento não encontrado</h1>
        <Link to="/admin/departamentos" className="text-primary">
          Ver departamentos
        </Link>
      </main>
    );
  return null;
}
