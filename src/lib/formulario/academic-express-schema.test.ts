import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {freshTemplate} from "./research-templates";
import {academicExpressSteps,academicExpressUrbanTemplate,academicExpressF01Template,isAcademicExpress,daysUntilCommunityLaunch} from "./academic-express-schema";
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

describe("F01 academic express v2 — published v1 remains unchanged", () => {
  it("captures pains once and preserves role-specific questions", () => {
    const schema = freshTemplate(academicExpressF01Template);
    expect(schema.experience).toBe("ACADEMIC_EXPRESS_F01_V2");
    expect(isAcademicExpress(schema)).toBe(true);
    expect(inspectSchema(schema)).toEqual([]);
    const questions = schema.sections.flatMap(section => section.questions);
    expect(questions.filter(q => q.semanticCode?.startsWith("MOBILITY_"))).toHaveLength(3);
    expect(questions).toHaveLength(9);
    expect(questions.some(q => ["TRANSPORT_MODE", "ACADEMIC_DRIVER_PRIORITY", "ACADEMIC_VEHICLE_MODEL", "COST_PER_TRIP", "ACCEPTABLE_FARE_RANGE"].includes(q.semanticCode ?? ""))).toBe(false);
    const role = questions.find(q => q.semanticCode === "RESEARCH_PARTICIPANT_ROLE")!;
    const both = createResearchVisibility(schema, { [role.id]: "AMBOS" });
    expect(both.questionVisible(questions.find(q => q.semanticCode === "SEATS_AVAILABLE")!)).toBe(true);
    expect(questions.some(q => q.semanticCode === "TRANSPORT_MODE")).toBe(false);
    expect(both.questionVisible(questions.find(q => q.semanticCode === "ACADEMIC_PASSENGER_PRIORITY")!)).toBe(true);
    const driver = createResearchVisibility(schema, { [role.id]: "MOTORISTA" });
    expect(["MOBILITY_PAINS","MOBILITY_PRIMARY_PAIN","MOBILITY_OTHER_PAIN"].every(code =>
      !driver.questionVisible(questions.find(q => q.semanticCode === code)!))).toBe(true);
    const passenger = createResearchVisibility(schema, { [role.id]: "PASSAGEIRO" });
    expect(passenger.questionVisible(questions.find(q => q.semanticCode === "MOBILITY_PAINS")!)).toBe(true);
  });
});

describe("UNIFOR F01 V4 migration rollout", () => {
  it("creates a new published version and keeps older answers and receipts", () => {
    const sql = readFileSync("drizzle/migrations/0117_unifor_f01_v4_rollout.sql", "utf8");
    expect(sql).toContain("latest+1");
    expect(sql).toContain("ACADEMIC_EXPRESS_F01_V2");
    expect(sql).toContain("unifor.br");
    expect(sql).not.toMatch(/UPDATE public\.research_answers|DELETE FROM public\.research_answers/);
    expect(sql).toContain("INSERT INTO public.research_form_versions");
  });
});

describe("dynamic calendar-day countdown", () => {
  it("uses the institution timezone rather than Fortaleza hardcoding", () => {
    const now = new Date("2026-11-03T22:30:00Z");
    expect(daysUntilCommunityLaunch("2026-11-04","America/Fortaleza",now)).toBe(1);
    expect(daysUntilCommunityLaunch("2026-11-04","Asia/Tokyo",now)).toBe(0);
    expect(daysUntilCommunityLaunch(null,"America/Fortaleza",now)).toBeNull();
  });
});


describe("Approved UNILAB Glass UX + passenger pains preserved in both universities", () => {
  it("creates new academic V2 versions without rewriting legacy answers", () => {
    const sql = readFileSync(
      "drizzle/migrations/0121_university_express_passenger_pains_unification.sql", "utf8");
    expect(sql).toContain("'UNILAB-1'");
    expect(sql).toContain("'0K9K09K'");
    expect(sql).toContain("ACADEMIC_EXPRESS_F01_V2");
    expect(sql).toContain("MOBILITY_PAINS");
    expect(sql).toContain("MOBILITY_PRIMARY_PAIN");
    expect(sql).toContain("MOBILITY_OTHER_PAIN");
    expect(sql).toContain("'PASSAGEIRO'");
    expect(sql).toContain("'AMBOS'");
    expect(sql).toContain("gen_random_uuid()");
    expect(sql).not.toMatch(/(?:UPDATE|DELETE\s+FROM)\s+public\.research_answers/i);
    expect(sql).toContain("published_at IS NULL");
    expect(sql).toContain("draft_schema IS DISTINCT FROM previous_schema");
  });

  it("keeps passenger + ambos pains required in schema; driver-only cannot see them", () => {
    const schema=freshTemplate(academicExpressF01Template);
    const questions=schema.sections.flatMap(s=>s.questions);
    const role=questions.find(q=>q.semanticCode==="RESEARCH_PARTICIPANT_ROLE")!;
    for (const value of ["PASSAGEIRO","AMBOS"]) {
      const access=createResearchVisibility(schema,{[role.id]:value});
      for (const code of ["MOBILITY_PAINS","MOBILITY_PRIMARY_PAIN"]) {
        const pain=questions.find(q=>q.semanticCode===code)!;
        expect(pain.required).toBe(true);
        expect(access.questionVisible(pain)).toBe(true);
      }
    }
    const driver=createResearchVisibility(schema,{[role.id]:"MOTORISTA"});
    expect(driver.questionVisible(questions.find(q=>q.semanticCode==="MOBILITY_PAINS")!)).toBe(false);
  });
});

describe("UNILAB versioned Express rollout", () => {
  it("retains V1-V4 and excludes budget/price and technical pain labels from V5", () => {
    const migration = readFileSync("drizzle/migrations/0118_unilab_f01_v5_rollout.sql", "utf8");
    expect(migration).toContain("UNILAB-1");
    expect(migration).toContain("ACADEMIC_EXPRESS_F01_V2");
    expect(migration).toContain("latest+1");
    expect(migration).toContain("unilab.edu.br");
    expect(migration).not.toMatch(/UPDATE public\.research_answers|DELETE FROM public\.research_answers/);
    expect(migration).not.toContain("DOR_01");
    expect(migration).not.toContain("ACCEPTABLE_FARE_RANGE");
  });
});
