import {describe,expect,it} from "vitest";
import {RESEARCH_TEMPLATES,freshTemplate} from "./research-templates";
import {inspectSchema} from "./research-schema";
import {requiredResearchSchemaVersion} from "./research-catalog";
import {URBAN_UNIVERSITY_KEY} from "./urban-university";
import {REGIONAL_UNIVERSITY_KEY} from "./regional-university";
import {EVENT_EXIT_MATCH_KEY} from "./event-exit-match";
import {COMPANY_CAMPUS_DRIVER_KEY} from "./company-campus-driver";
import {CORPORATE_INTERNAL_KEY} from "./corporate-internal";

const official=[
  [URBAN_UNIVERSITY_KEY,"EDUCACAO",95],
  [REGIONAL_UNIVERSITY_KEY,"EDUCACAO",97],
  [EVENT_EXIT_MATCH_KEY,"EVENTO",95],
  [COMPANY_CAMPUS_DRIVER_KEY,"EMPRESA",98],
  [CORPORATE_INTERNAL_KEY,"EMPRESA",99],
] as const;

describe("Integração de todos os modelos do CARONAA",()=>{
  it("preserves 5 unique registered institutional templates",()=>{
    const keys=RESEARCH_TEMPLATES.map(t=>t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for(const [key,nature] of official){
      const matches=RESEARCH_TEMPLATES.filter(t=>t.key===key);
      expect(matches).toHaveLength(1);
      expect(matches[0].nature).toBe(nature);
    }
  });
  it("validates and independently clones each template without copying question IDs",()=>{
    for(const [key] of official){
      const template=RESEARCH_TEMPLATES.find(t=>t.key===key)!;
      expect(inspectSchema(template.schema)).toEqual([]);
      const a=freshTemplate(template),b=freshTemplate(template);
      expect(inspectSchema(a)).toEqual([]);
      expect(a.sections[0].questions[0].id).not.toBe(b.sections[0].questions[0].id);
      for(const section of a.sections){
        const questions=a.sections.flatMap(x=>x.questions);
        for(const q of section.questions){
          if(q.showWhen) expect(questions.some(p=>p.id===q.showWhen?.questionId)).toBe(true);
        }
      }
    }
  });
  it("refuses models with unapplied SQL migrations while allowing pre-existing surveys",()=>{
    for(const [key,,version] of official)
      expect(requiredResearchSchemaVersion(key)).toBe(version);
    expect(requiredResearchSchemaVersion(undefined)).toBe(95);
    expect(requiredResearchSchemaVersion("ROTA_ESCOLAR")).toBe(95);
  });
  it("does not confuse employee-only corporate research with general public surveys",()=>{
    const internal=RESEARCH_TEMPLATES.find(t=>t.key===CORPORATE_INTERNAL_KEY)!;
    const event=RESEARCH_TEMPLATES.find(t=>t.key===EVENT_EXIT_MATCH_KEY)!;
    expect(internal.schema.sections.flatMap(s=>s.questions).some(q=>q.semanticCode==="CORP_DRIVES_CAR")).toBe(true);
    expect(event.schema.sections.flatMap(s=>s.questions).some(q=>q.semanticCode==="EVENT_OFFER_POSSIBLE")).toBe(true);
    expect(internal.schema.sections.flatMap(s=>s.questions).some(q=>q.semanticCode==="PAYMENT_CONFIRMED")).toBe(false);
  });
});
