import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  // Admin loaders call auth-protected server functions; run them in the browser where the session exists.
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminGuard>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </AdminGuard>
  );
}
