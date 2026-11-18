import { describe, expect, it } from "vitest";
import { detailsSchema, professionalFormCorrections, professionalServerCorrections } from "./mototaxi-registration";

const valid = {
  firstName: "Maria", lastName: "Silva", whatsapp: "(85) 99999-9999",
  region: "MACICO_BATURITE", registrationNumber: "MT-1234",
};

describe("mototaxi simplified registration", () => {
  it("accepts the Maciço registration without plate, CPF, model or university", () => {
    expect(detailsSchema.parse(valid)).toEqual({
      ...valid, whatsapp: "85999999999",
    });
  });
  it("normalizes country prefix and phone mask", () => {
    expect(detailsSchema.parse({ ...valid, whatsapp: "+55 (85) 99999-9999" }).whatsapp).toBe("85999999999");
  });
  it("accepts the selected Fortaleza region", () => {
    expect(detailsSchema.parse({ ...valid, region: "FORTALEZA" }).region).toBe("FORTALEZA");
  });
  it.each([
    [{ ...valid, firstName: "A" }, "short first name"],
    [{ ...valid, lastName: "" }, "missing surname"],
    [{ ...valid, whatsapp: "123" }, "invalid phone"],
    [{ ...valid, registrationNumber: "" }, "missing registration"],
    [{ ...valid, region: "OTHER" }, "unavailable region"],
    [{ ...valid, firstName: "Maria Clara" }, "additional name"],
  ])("rejects %s (%s)", value => {
    expect(detailsSchema.safeParse(value).success).toBe(false);
  });
});


describe("confirmação automática dos dados profissionais", () => {
  const complete = {
    firstName: "Maria", lastName: "Silva", whatsapp: "(85) 99999-9999",
    region: "MACICO_BATURITE", registrationNumber: "MT-1234",
    photo: null,
    photoUrl: "https://storage.example.com/storage/v1/object/public/avatars/driver-1/photo.jpg",
    userId: "driver-1",
  };
  it("lists all fields missing without silently choosing a region", () => {
    const errors = professionalFormCorrections({
      ...complete, firstName: "", lastName: "", whatsapp: "", region: "",
      registrationNumber: "", photoUrl: "",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "firstName","lastName","photo","region","registrationNumber","whatsapp",
    ].sort());
    expect(errors.region).toMatch(/Selecione a região/i);
  });
  it("reuses a valid photo stored in the account's own avatar folder", () => {
    expect(professionalFormCorrections(complete)).toEqual({});
  });
  it("requires another photo when the profile image belongs to an external provider", () => {
    expect(professionalFormCorrections({...complete,photoUrl:"https://other.example.com/picture.jpg"}).photo).toMatch(/foto pessoal/i);
  });
  it("accepts a new photo, but rejects unsupported or oversized files", () => {
    expect(professionalFormCorrections({...complete, photoUrl:"",photo:{type:"image/jpeg",size:1234}})).toEqual({});
    expect(professionalFormCorrections({...complete,photo:{type:"application/pdf",size:1234}}).photo).toMatch(/JPG/i);
    expect(professionalFormCorrections({...complete,photo:{type:"image/jpeg",size:6*1024*1024}}).photo).toMatch(/5 MB/i);
  });
  it("translates server-side requirements into the precise form fields", () => {
    const missing=professionalServerCorrections({message:"Dados pendentes: FULL_NAME,PHOTO,WHATSAPP,REGISTRATION,REGION"});
    expect(Object.keys(missing).sort()).toEqual([
      "firstName","lastName","photo","region","registrationNumber","whatsapp",
    ].sort());
    expect(professionalServerCorrections({message:"Envie uma foto de perfil valida antes de solicitar acesso"}).photo).toBeTruthy();
    expect(professionalServerCorrections({message:"Unexpected network error"})).toEqual({});
  });
});
