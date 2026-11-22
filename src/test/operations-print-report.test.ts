import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
describe("CARONAA dedicated colored operations PDF",()=>{
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const pdf=readFileSync("src/components/admin/OperationsPrintableReport.tsx","utf8");
  const css=readFileSync("src/components/admin/operations-history-print.css","utf8");
  it("prints a separate document, not the admin dashboard",()=>{
    expect(ui).toContain("OperationsPrintableReport");
    expect(ui).toContain("caronaa-screen-report");
    expect(css).toContain(".caronaa-screen-report { display: none !important; }");
    expect(css).toContain(".caronaa-print-sheet {");
    expect(css).toContain("@page { size: A4 landscape;");
    expect(css).toContain("body:has(.caronaa-print-sheet)");
  });
  it("forces colors and includes only essential aggregate indicators",()=>{
    expect(css).toContain("-webkit-print-color-adjust: exact !important");
    expect(css).toContain("print-color-adjust: exact !important");
    expect(css).toContain("background: #FFF8E4");
    expect(css).toContain("background: #16A34A");
    expect(pdf).toContain('import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json"');
    expect(pdf).toContain('src={logoAsset.url}');
    expect(pdf).toContain("logotipo oficial");
    expect(pdf).not.toContain('opr-pdf-symbol');
    expect(css).toContain(".opr-pdf-logo");
    expect(pdf).toContain("Pedidos feitos");
    expect(pdf).toContain("Conversão e atendimento");
    expect(pdf).toContain("Demanda por horário");
    expect(pdf).toContain("Distribuição da demanda · dia × hora");
    expect(pdf).not.toContain("passenger_name");
    expect(pdf).not.toContain("driver_name");
  });
  it("uses the true report query and timeframe, and does not alter database records",()=>{
    expect(ui).toContain("summary={report.summary}");
    expect(ui).toContain("hours={report.hours}");
    expect(ui).toContain("hourDays={report.hour_days}");
    expect(ui).toContain("generatedAt={report.generated_at}");
    expect(pdf).toContain("Tarifas não equivalem a pagamentos recebidos");
  });
});