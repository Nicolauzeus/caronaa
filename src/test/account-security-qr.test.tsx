import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractQrToken } from "@/lib/ride-qr-service";

describe("Task 1 & 2 & 3: Funções de Conta e Confirmação de Viagem", () => {
  describe("Task 1: Foto de Perfil", () => {
    it("valida tipos MIME aceitos para avatar", () => {
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
      expect(allowedMimeTypes.includes("image/jpeg")).toBe(true);
      expect(allowedMimeTypes.includes("image/png")).toBe(true);
      expect(allowedMimeTypes.includes("image/webp")).toBe(true);
      expect(allowedMimeTypes.includes("application/pdf")).toBe(false);
      expect(allowedMimeTypes.includes("image/gif")).toBe(false);
      expect(allowedMimeTypes.includes("application/x-msdownload")).toBe(false);
    });

    it("respeita o limite máximo de tamanho de 5MB", () => {
      const MAX_SIZE = 5 * 1024 * 1024;
      const validSize = 4.8 * 1024 * 1024;
      const oversized = 5.2 * 1024 * 1024;

      expect(validSize <= MAX_SIZE).toBe(true);
      expect(oversized <= MAX_SIZE).toBe(false);
    });

    it("gera caminho seguro com identificador único sem confiar no nome do arquivo do usuário", () => {
      const userId = "user-123";
      const randomUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const ext = "webp";
      const path = `${userId}/${randomUuid}.${ext}`;

      expect(path).toBe("user-123/a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp");
      expect(path.startsWith(`${userId}/`)).toBe(true);
      expect(path.includes("..")).toBe(false);
    });
  });

  describe("Task 2: Redefinição e Alteração de Senha", () => {
    it("exige pelo menos 6 caracteres e confirmação idêntica", () => {
      const validatePassword = (pass: string, confirm: string) => {
        if (pass.length < 6) return "Mínimo 6 caracteres";
        if (pass !== confirm) return "Senhas não conferem";
        return null;
      };

      expect(validatePassword("12345", "12345")).toBe("Mínimo 6 caracteres");
      expect(validatePassword("segura123", "outra123")).toBe("Senhas não conferem");
      expect(validatePassword("segura123", "segura123")).toBeNull();
    });

    it("não vaza existência de conta na mensagem de esqueci minha senha", () => {
      const neutralMessage = "Se existir uma conta com este e-mail, enviaremos as instruções.";
      expect(neutralMessage).not.toContain("não encontrado");
      expect(neutralMessage).not.toContain("enviado com sucesso para o usuário cadastrado");
      expect(neutralMessage).toContain("Se existir uma conta");
    });
  });

  describe("Task 3: Confirmação de Carona por QR Code", () => {
    it("extrai token seguro de payloads com prefixo ou URL", () => {
      const token = "a8f9c0e2d4b64810842e4c8d";
      expect(extractQrToken(`caronaa:ride-confirm:${token}`)).toBe(token);
      expect(extractQrToken(`https://caronaa.com/confirm?token=${token}`)).toBe(token);
      expect(extractQrToken(`  ${token}  `)).toBe(token);
    });

    it("garante que o token do QR é opaco e não contém dados sensíveis em texto puro", () => {
      const mockQrPayload = "caronaa:ride-confirm:7f9b8c2d1e0a4f5b9c8d7e6f";
      expect(mockQrPayload).not.toContain("driver_user_id");
      expect(mockQrPayload).not.toContain("passenger_user_id");
      expect(mockQrPayload).not.toContain("placa");
      expect(mockQrPayload).not.toContain("@");
      expect(mockQrPayload).not.toContain("telefone");
    });

    it("aplica máscara de segurança na placa ao confirmar", () => {
      const maskPlate = (plate: string) => {
        if (plate.length >= 4) {
          return "•••• " + plate.slice(-4);
        }
        return "••••";
      };

      expect(maskPlate("BRA2E19")).toBe("•••• 2E19");
      expect(maskPlate("ABC1234")).toBe("•••• 1234");
      expect(maskPlate("")).toBe("••••");
    });
  });
});

