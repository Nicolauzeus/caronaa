import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SimpleMobilityPains } from "./SimpleMobilityPains";
import { simpleMobilityTemplates, applySimplePainAnswer, simplePainFields } from "@/lib/formulario/mobility-simple";
import { freshTemplate } from "@/lib/formulario/research-templates";
import { useState } from "react";
import type { Answers } from "@/lib/formulario/research-schema";

function Harness(){
  const [schema]=useState(()=>freshTemplate(simpleMobilityTemplates[0]));
  const [answers,setAnswers]=useState<Answers>({});
  const change=(id:string,value:string|string[])=>setAnswers(previous=>applySimplePainAnswer(schema,previous,id,value));
  const {pains,primary}=simplePainFields(schema);
  return <>
    <SimpleMobilityPains schema={schema} answers={answers} errors={{}} onChange={change}/>
    <output data-testid="answers">{JSON.stringify({
      selected:answers[pains!.id] ?? [],primary:answers[primary!.id]??null,
    })}</output>
  </>;
}

describe("F01 — seleção de dores no celular",()=>{
  it("mantém seleção e dor principal na mesma tela, com opções mutuamente exclusivas",()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole("checkbox",{name:/Ônibus lotados/i}));
    fireEvent.click(screen.getByRole("checkbox",{name:/Preço alto/i}));
    expect(screen.getByRole("radiogroup",{name:/Qual dessas é a principal/i})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio",{name:/Preço alto/i}));
    expect(screen.getByTestId("answers").textContent).toContain('"primary":"PRECO_ALTO"');
    fireEvent.click(screen.getByRole("checkbox",{name:/Nenhuma dessas dificuldades/i}));
    expect(screen.getByTestId("answers").textContent).toContain('"selected":["SEM_DIFICULDADES"]');
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
  it("limita a seleção a três opções",()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole("checkbox",{name:/Ônibus lotados/i}));
    fireEvent.click(screen.getByRole("checkbox",{name:/Preço alto/i}));
    fireEvent.click(screen.getByRole("checkbox",{name:/Tempo de espera/i}));
    expect(screen.getByRole("checkbox",{name:/Atrasos frequentes/i})).toBeDisabled();
  });
});
