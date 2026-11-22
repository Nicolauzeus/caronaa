import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
describe("CARONAA price quote card by date and service",()=>{
  const sql=readFileSync("drizzle/migrations/0238_admin_price_quotes_report.sql","utf8");
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const quotesUi=readFileSync("src/components/admin/OperationsPriceQuotes.tsx","utf8");
  const print=readFileSync("src/components/admin/OperationsPrintableReport.tsx","utf8");
  const pdf=readFileSync("src/components/admin/operations-pdf-file.ts","utf8");
  it("uses issued quote rows rather than searches, scoped to Fortaleza and service",()=>{
    expect(sql).toContain("public.caronaa_quick_fare_quotes");
    expect(sql).toContain("public.offer_route_quotes");
    expect(sql).toContain("q.issued_at>=v_from");
    expect(sql).toContain("q.created_at>=v_from");
    expect(sql).toContain("p_service IN ('all','flash')");
    expect(sql).toContain("p_service IN ('all','shared')");
    expect(sql).toContain("AT TIME ZONE 'America/Fortaleza'");
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("count(DISTINCT user_id)");
  });
  it("obeys the same period, service and refresh filters as ride KPIs",()=>{
    expect(ui).toContain('"admin_caronaa_price_quotes_report"');
    expect(ui).toContain("p_from:dates.from,p_to:dates.to,p_service:service");
    expect(ui).toContain("OperationsPriceQuotes");
    // The consolidated nav must NOT remove quote cards from Histórico & Relatórios.
    // The same persisted quotes can be explored more deeply in Inteligência.
    const reportSection=ui.slice(ui.indexOf('{mode==="reports"&&<>'));
    expect(reportSection).toContain('<OperationsPriceQuotes report={quotes} error={quotesError} loading={busy}/>');
    expect(reportSection.indexOf("<OperationsPriceQuotes")).toBeLessThan(reportSection.indexOf('aria-label="Resultados exclusivos das solicitações"'));
    const intelligenceSection=ui.slice(ui.indexOf('{mode==="intelligence"&&<>'));
    expect(intelligenceSection).toContain('<OperationsPriceQuotes report={quotes} error={quotesError} loading={busy}/>');
    expect(ui).toContain('"admin_caronaa_price_quotes_report"');
    expect(quotesUi).toContain("Cotações de preço geradas");
    expect(quotesUi).toContain("Pessoas que receberam cotação");
    expect(quotesUi).toContain("Cotações por dia");
  });
  it("exports recorded quote totals into printable and shareable PDFs",()=>{
    expect(ui).toContain("price_quotes:quotes??undefined");
    expect(ui).toContain("priceQuotes={quotes}");
    expect(print).toContain("Cotações de preço geradas");
    expect(pdf).toContain("COTACOES DE PRECO GERADAS");
    expect(pdf).toContain("d.price_quotes.summary.quotes_generated");
  });
});