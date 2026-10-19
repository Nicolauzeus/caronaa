import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/admin/MetricCard";

describe("Admin metric cards", () => {
  it("uses favorable and unfavorable trend colors by explicit semantic direction", () => {
    render(<MetricCard label="Viagens concluídas" value="120" trend="+12%" positive />);
    expect(screen.getByText("+12%").className).toContain("text-emerald-700");
    render(<MetricCard label="Cancelamentos" value="14" trend="+8%" positive={false} />);
    expect(screen.getByText("+8%").className).toContain("text-red-700");
  });
  it("keeps neutral cards on the CARONAA primary border without inventing a trend", () => {
    const { container } = render(<MetricCard label="Total de respostas" value="0" />);
    expect(container.querySelector(".border-t-primary")).not.toBeNull();
    expect(screen.queryByText("+12%")).not.toBeInTheDocument();
  });
});
