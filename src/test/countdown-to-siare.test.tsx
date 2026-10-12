import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownToSiare } from "@/components/caronaa/CountdownToSiare";

describe("Contagem regressiva do evento encerrado", () => {
  it("não renderiza mais promoção ou chamada para o evento", () => {
    const { container } = render(<CountdownToSiare />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Siará Tech Summit/i)).not.toBeInTheDocument();
  });
});
