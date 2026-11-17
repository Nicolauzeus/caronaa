import { describe, expect, it } from "vitest";
import {
  generateProfessionalPassword,
  passwordGuidance,
  professionalAuthErrorMessage,
  professionalAuthErrorCode,
  registrationPasswordError,
} from "./professional-auth";

describe("cadastro profissional: senhas", () => {
  it("mantém a regra atual de oito caracteres e exige confirmação", () => {
    expect(registrationPasswordError("abcdefg", "abcdefg")).toMatch(/8 caracteres/);
    expect(registrationPasswordError("abcdefgh", "abcdefgi")).toMatch(/não coincidem/);
    expect(registrationPasswordError("abcdefgh", "abcdefgh")).toBeNull();
  });

  it("indica a força progressivamente", () => {
    expect(passwordGuidance("").score).toBe(0);
    expect(passwordGuidance("123").label).toBe("Muito curta");
    expect(passwordGuidance("SenhaForte123!ComMais").label).toBe("Forte");
  });

  it("gera senha aleatória de 18 caracteres contendo tipos diferentes", () => {
    const value = generateProfessionalPassword();
    expect(value).toHaveLength(18);
    expect(value).toMatch(/[a-z]/);
    expect(value).toMatch(/[A-Z]/);
    expect(value).toMatch(/[0-9]/);
    expect(value).toMatch(/[!@#$%*\-_]/);
  });

  it("não expõe detalhes técnicos de falhas de login ao usuário", () => {
    expect(professionalAuthErrorMessage(new Error("Invalid login credentials"))).toMatch(/E-mail ou senha incorretos/);
    expect(professionalAuthErrorMessage(new Error("unknown secret code"))).not.toContain("secret");
    expect(professionalAuthErrorMessage({status:400,code:"weak_password",message:"Password is weak"})).toMatch(/segurança/);
    expect(professionalAuthErrorMessage({status:400,code:"email_exists"})).toMatch(/já possui uma conta/);
    expect(professionalAuthErrorMessage({status:400,code:"unexpected_failure"})).toMatch(/logs de Auth/);
    expect(professionalAuthErrorCode({status:400,code:"email_exists"})).toBe("email_exists");
    expect(professionalAuthErrorCode({status:400})).toBe("HTTP_400");
  });
});
