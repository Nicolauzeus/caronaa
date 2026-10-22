import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {freshTemplate} from "./research-templates";
import {academicExpressSteps,academicExpressUrbanTemplate,isAcademicExpress} from "./academic-express-schema";
import {inspectSchema,cleanAnswers,validatePage} from "./research-schema";
import {createResearchVisibility} from "./research-conditions";

describe("four/five stage university express questionnaire",()=>{
  const schema=freshTemplate(academicExpressUrbanTemplate);
  const all=schema.sections.flatMap(s=>s.questions);
  const by=(code:string)=>all.find(q=>q.semanticCode===code)!;
  const role=by("RESEARCH_PARTICIPANT_ROLE");
  const qDriver=[by("URBAN_OFFER_VEHICLE"),by("SEATS_AVAILABLE"),by("ACADEMIC_DRIVER_PRIORITY")];
  const qPassenger=[by("TRANSPORT_MODE"),by("ACADEMIC_PASSENGER_PRIORITY")];

  it("has no redundant pain/price-intention questions and exactly 4 or 5 stages",()=>{
    expect(isAcademicExpress(schema)).toBe(true);
    expect(inspectSchema(schema)).toEqual([]);
    expect(all).toHaveLength(9);
    expect(academicExpressSteps("PASSAGEIRO")).toEqual(["identity","role","route","specific","activation"]);
    expect(academicExpressSteps("MOTORISTA")).toEqual(["identity","role","route","specific","activation"]);
    expect(academicExpressSteps("AMBOS")).toEqual(["identity","role","route","specific","activation"]);
    expect(all.some(q=>["URBAN_PRIMARY_PAIN","MOBILITY_PAINS","ACCEPTABLE_FARE_RANGE","BOOKING_INTENT","LAUNCH_PARTICIPATION_INTENT"].includes(q.semanticCode??""))).toBe(false);
  });
  it("hides all driver questions from passengers and vice versa; AMBOS shares both",()=>{
    const p=createResearchVisibility(schema,{[role.id]:"PASSAGEIRO"});
    expect(qDriver.every(q=>!p.questionVisible(q))).toBe(true);
    expect(qPassenger.every(q=>p.questionVisible(q))).toBe(true);
    const d=createResearchVisibility(schema,{[role.id]:"MOTORISTA"});
    expect(qPassenger.every(q=>!d.questionVisible(q))).toBe(true);
    expect(qDriver.every(q=>d.questionVisible(q))).toBe(true);
    const both=createResearchVisibility(schema,{[role.id]:"AMBOS"});
    expect([...qPassenger,...qDriver].every(q=>both.questionVisible(q))).toBe(true);
  });
  it("removes stale fields when role changes and does not validate invisible required ones",()=>{
    const ans={[role.id]:"PASSAGEIRO",[qDriver[0].id]:"CARRO",[qDriver[1].id]:"3"};
    expect(cleanAnswers(schema,ans)).toEqual({[role.id]:"PASSAGEIRO"});
    expect(validatePage(schema.sections[2],ans,all,schema)).toEqual([]);
    expect(validatePage(schema.sections[2],{[role.id]:"MOTORISTA"},all,schema)).toContain("Responda: Qual veículo usaria para oferecer carona?");
    expect(qDriver[1].maxValue).toBe(7);
  });
  it("changes production via new published version, not rewriting historic survey answers",()=>{
    const migration=readFileSync("drizzle/migrations/0113_unifor_academic_express_publication.sql","utf8");
    expect(migration).toContain("latest_version+1");
    expect(migration).toContain("ACADEMIC_EXPRESS_V1");
    expect(migration).toContain("UNIFOR version");
    expect(migration).not.toMatch(/UPDATE public\.research_answers|DELETE FROM public\.research_answers/);
  });
});
