import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminService } from "@/mockData";

const filters = [
  { label: "Todos", value: "all" },
  { label: "Motorista", value: "motorista" },
  { label: "Passageiro", value: "passageiro" },
  { label: "Os dois", value: "ambos" },
  { label: "Verificados", value: "verificados" },
  { label: "Novos", value: "novos" },
  { label: "Bloqueados", value: "bloqueados" },
];

export const Route = createFileRoute("/admin/usuarios/")({
  head: () => ({
    meta: [
      { title: "Usuários — Administração CARONAA" },
      { name: "description", content: "Gerencie os usuários da comunidade CARONAA." },
      { property: "og:title", content: "Usuários — Administração CARONAA" },
      { property: "og:description", content: "Gerencie os usuários da comunidade CARONAA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const users = useMemo(() => adminService.listUsers({ filter, search: query }), [filter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Pessoas</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Usuários</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <span>Base ativa</span>
          <span className="font-semibold text-foreground">{users.length}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nome, email, telefone ou ID"
              className="h-11 border-border bg-background pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={filter === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-secondary/40 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuário</th>
                <th className="px-4 py-3 font-semibold">Perfil</th>
                <th className="px-4 py-3 font-semibold">Verificação</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Cadastro</th>
                <th className="px-4 py-3 font-semibold">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado para esta busca.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-border text-sm text-foreground hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/usuarios/$id"
                        params={{ id: user.id }}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium">{user.profile}</p>
                        <p className="text-xs text-muted-foreground">{user.city}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                        {user.verification}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.joinedAt}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.lastActive}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
