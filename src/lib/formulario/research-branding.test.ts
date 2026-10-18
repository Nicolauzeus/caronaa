import {describe,it,expect} from "vitest";
import {validateResearchBrandImage,RESEARCH_BRAND_IMAGE_MAX_BYTES} from "./research-branding";
describe("Research branding upload policy",()=>{
 it("allows only supported public image formats",()=>{
  for(const type of ["image/png","image/jpeg","image/webp"]){
   expect(validateResearchBrandImage(type,1024)).toBeNull();
  }
  for(const type of ["image/svg+xml","image/gif","application/pdf","text/html"]){
   expect(validateResearchBrandImage(type,1024)).not.toBeNull();
  }
 });
 it("rejects blank and oversized images",()=>{
  expect(validateResearchBrandImage("image/png",0)).not.toBeNull();
  expect(validateResearchBrandImage("image/png",RESEARCH_BRAND_IMAGE_MAX_BYTES+1)).not.toBeNull();
  expect(validateResearchBrandImage("image/png",RESEARCH_BRAND_IMAGE_MAX_BYTES)).toBeNull();
 });
});