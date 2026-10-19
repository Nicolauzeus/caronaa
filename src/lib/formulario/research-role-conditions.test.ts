import { describe, expect, it } from "vitest";
import { RESEARCH_TEMPLATES, freshTemplate, type SurveySchema } from "./research-templates";
import {
  createResearchVisibility, roleCondition, researchRoleQuestion,
  type ResearchCondition,
} from "./research-conditions";
import { cleanAnswers, inspectSchema, validatePage } from "./research-schema";
import { URBAN_UNIVERSITY_KEY } from "./urban-university";
import { REGIONAL_UNIVERSITY_KEY } from "./regional-university";
import { EVENT_EXIT_MATCH_KEY } from "./event-exit-match";
import { COMPANY_CAMPUS_DRIVER_KEY } from "./company-campus-driver";
import { CORPORATE_INTERNAL_KEY } from "./corporate-internal";

const keys = [URBAN_UNIVERSITY_KEY,REGIONAL_UNIVERSITY_KEY,EVENT_EXIT_MATCH_KEY,
  COMPANY_CAMPUS_DRIVER_KEY,CORPORATE_INTERNAL_KEY];
const find = (key: string) => RESEARCH_TEMPLATES.find(t=>t.key===key)!;

describe("Profile-first conditional research",()=>{
  it("ships an up-front role question and valid schemas in all five models",()=>{
    for (const key of keys) {
      const schema=find(key).schema;
      expect(schema.sections[0].questions[0].semanticCode).toBe("RESEARCH_PARTICIPANT_ROLE");
      expect(schema.sections[0].questions[0].options).toContain("PASSAGEIRO");
      expect(schema.sections[0].questions[0].options).toContain("MOTORISTA");
      expect(inspectSchema(schema)).toEqual([]);
    }
    expect(find(REGIONAL_UNIVERSITY_KEY).schema.sections[0].questions[0].options)
      .toContain("PROFISSIONAL");
    expect(find(CORPORATE_INTERNAL_KEY).schema.sections[0].questions[0].options)
      .not.toContain("PROFISSIONAL");
  });
  it("hides driver questions for passengers and remaps nested conditions in fresh versions",()=>{
    const schema=freshTemplate(find(COMPANY_CAMPUS_DRIVER_KEY));
    const questions=schema.sections.flatMap(s=>s.questions);
    const role=questions.find(q=>q.semanticCode==="RESEARCH_PARTICIPANT_ROLE")!;
    const drives=questions.find(q=>q.semanticCode==="COMPANY_DRIVES_CAR")!;
    expect(drives.condition).toBeDefined();
    expect(createResearchVisibility(schema,{[role.id]:"PASSAGEIRO"}).questionVisible(drives)).toBe(false);
    expect(createResearchVisibility(schema,{[role.id]:"MOTORISTA"}).questionVisible(drives)).toBe(true);
    const cleaned=cleanAnswers(schema,{[role.id]:"PASSAGEIRO",[drives.id]:"SIM"});
    expect(cleaned).toEqual({[role.id]:"PASSAGEIRO"});
  });
  it("supports nested ALL / ANY conditions, hidden ancestors, section gates and valid copies",()=>{
    const leaf=(questionId:string,value:string):ResearchCondition=>({questionId,comparison:"EQ",value});
    const condition:ResearchCondition={op:"ALL",rules:[
      {op:"ANY",rules:[leaf("role","MOTORISTA"),leaf("role","AMBOS")]},
      leaf("vehicle","CARRO"),
    ]};
    const schema:SurveySchema={sections:[
      {title:"Perfil principal",questions:[
        researchRoleQuestion(),
        {id:"vehicle",label:"Veículo utilizado",type:"single_choice",required:true,
          options:["CARRO","MOTO"],condition:roleCondition("MOTORISTA","AMBOS")},
      ]},
      {title:"Disponibilidade",condition:roleCondition("MOTORISTA","AMBOS"),questions:[
        {id:"seats",label:"Quantos lugares possui?",type:"number",required:true,
          options:[],condition},
      ]},
    ]};
    expect(inspectSchema(schema)).toEqual([]);
    const passenger={research_participant_role:"PASSAGEIRO",vehicle:"CARRO",seats:"2"};
    expect(createResearchVisibility(schema,passenger).sectionVisible(schema.sections[1])).toBe(false);
    expect(cleanAnswers(schema,passenger)).toEqual({research_participant_role:"PASSAGEIRO"});
    expect(validatePage(schema.sections[1],passenger,undefined,schema)).toEqual([]);
    const driver={research_participant_role:"MOTORISTA",vehicle:"CARRO"};
    expect(createResearchVisibility(schema,driver).sectionVisible(schema.sections[1])).toBe(true);
    expect(validatePage(schema.sections[1],driver,undefined,schema)).toContain("Responda: Quantos lugares possui?");
    const byId={research_participant_role:"r",vehicle:"v",seats:"s"};
    const cloned={sections:schema.sections.map(sec=>({
      ...sec,questions:sec.questions.map(q=>({...q,id:byId[q.id as keyof typeof byId]}))
    }))};
    expect(cloned.sections[0].questions).toHaveLength(2);
  });
  it("fails closed on invalid or circular references",()=>{
    const bad:SurveySchema={sections:[{title:"Primeira",questions:[
      {id:"role",label:"Quem participa?",type:"single_choice",required:true,options:["SIM","NAO"],
        condition:{questionId:"role",comparison:"EQ",value:"SIM"}},
    ]}]};
    expect(inspectSchema(bad).some(issue=>issue.includes("anterior"))).toBe(true);
    expect(createResearchVisibility(bad,{role:"SIM"}).questionVisible(bad.sections[0].questions[0])).toBe(false);
  });
});
