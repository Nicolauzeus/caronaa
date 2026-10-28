import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SavedAnswers } from "./SavedAnswers";

describe("SavedAnswers friendly labels", () => {
  it("formats Portuguese keys, money ranges, enums, and weekdays", () => {
    render(<SavedAnswers value={{
      days: [1, 2, 3, 4, 5],
      outboundTime: "07:00",
      returnTime: "22:00",
      direction: "IDA_E_VOLTA",
      flexibilityMinutes: 10,
      passengerFairPrice: "DE_5_A_10",
      "Dor principal": "DOR_04",
      marketingConsent: false,
    }}/>);
    expect(screen.getByText("Dias habituais")).toBeInTheDocument();
    expect(screen.getByText("Segunda a sexta-feira")).toBeInTheDocument();
    expect(screen.getByText("Horário de ida")).toBeInTheDocument();
    expect(screen.getByText("Horário de volta")).toBeInTheDocument();
    expect(screen.getByText("Ida e volta")).toBeInTheDocument();
    expect(screen.getByText("Tolerância de horário")).toBeInTheDocument();
    expect(screen.getByText("De R$ 5,00 a R$ 10,00")).toBeInTheDocument();
    expect(screen.getByText("Muito tempo gasto no deslocamento")).toBeInTheDocument();
    expect(screen.getByText("Não")).toBeInTheDocument();
  });

  it("renders previously unknown author fields without dropping source data", () => {
    render(<SavedAnswers value={{"Comentário da comunidade":"Ônibus demora",extraChoices:["ONIBUS","CARONA"]}}/>);
    expect(screen.getByText("Ônibus demora")).toBeInTheDocument();
    expect(screen.getByText("Ônibus, Carona")).toBeInTheDocument();
  });
});
