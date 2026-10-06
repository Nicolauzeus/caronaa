// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { describe, it, expect, vi } from "vitest";
import {
  normalizeAddress,
  geocodeAddress,
  formatLocation,
  calculateDistance,
  isWithinRadius,
} from "@/lib/location/geo-utils";
import {
  CatalogGeocodingProvider,
  CompositeGeocodingProvider,
} from "@/lib/location/geocoding-adapter";
import type { GeocodingProvider } from "@/lib/location/types";

describe("Location Layer & Geocoding Adapter", { timeout: 15000 }, () => {
  const catalogProvider = new CatalogGeocodingProvider();

  describe("1. Endereço Válido (Autocomplete & Geocoding)", () => {
    it("deve reconhecer UNIFOR / Universidade de Fortaleza com coordenadas e detalhes", async () => {
      const searchRes = await catalogProvider.search("Unifor");
      expect(searchRes.suggestions.length).toBeGreaterThan(0);

      const unifor = searchRes.suggestions[0];
      expect(unifor.mainText).toContain("Universidade de Fortaleza");
      expect(unifor.city).toBe("Fortaleza");
      expect(unifor.state).toBe("CE");
      expect(unifor.lat).toBeCloseTo(-3.7698, 2);
      expect(unifor.lng).toBeCloseTo(-38.4788, 2);

      const geocodeRes = await geocodeAddress("Unifor");
      expect(geocodeRes).not.toBeNull();
      expect(geocodeRes?.formattedAddress).toContain("Av. Washington Soares");
      expect(geocodeRes?.lat).toBeDefined();
      expect(geocodeRes?.lng).toBeDefined();
    });

    it("deve reconhecer Centro de Eventos do Ceará", async () => {
      const res = await catalogProvider.search("Centro de Eventos");
      expect(res.suggestions.length).toBeGreaterThan(0);
      const cec = res.suggestions.find((s) => s.mainText.includes("Centro de Eventos"));
      expect(cec).toBeDefined();
      expect(cec?.city).toBe("Fortaleza");
    });

    it("deve reconhecer bairro Aldeota", async () => {
      const res = await catalogProvider.search("Aldeota");
      expect(res.suggestions.length).toBeGreaterThan(0);
      expect(res.suggestions[0].neighborhood).toBe("Aldeota");
      expect(res.suggestions[0].city).toBe("Fortaleza");
    });
  });

  describe("2. Resultado Ambíguo", () => {
    it("deve retornar múltiplas opções estruturadas para termos ambíguos como 'Centro'", async () => {
      const searchRes = await catalogProvider.search("Centro");
      // Espera mais de um resultado (ex.: Bairro Centro e Centro de Eventos)
      expect(searchRes.suggestions.length).toBeGreaterThanOrEqual(2);

      const mainTexts = searchRes.suggestions.map((s) => s.mainText);
      expect(mainTexts).toContain("Centro");
      expect(mainTexts.some((t) => t.includes("Centro de Eventos"))).toBe(true);
    });
  });

  describe("3. Serviço Indisponível (Falha Graciosa)", () => {
    it("deve fazer fallback transparente para o catálogo quando o provedor primário falhar", async () => {
      const failingPrimary: GeocodingProvider = {
        name: "Failing Provider",
        isConfigured: () => true,
        search: vi.fn().mockRejectedValue(new Error("Network connection timeout")),
        getDetails: vi.fn().mockRejectedValue(new Error("Service 503 Unavailable")),
        geocode: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
      };

      const composite = new CompositeGeocodingProvider(failingPrimary);

      // Busca deve continuar funcionando via catálogo sem lançar exceção
      const searchRes = await composite.search("Unifor");
      expect(searchRes.suggestions.length).toBeGreaterThan(0);
      expect(searchRes.suggestions[0].mainText).toContain("Universidade de Fortaleza");

      // Geocode deve cair suavemente no catálogo
      const geoRes = await composite.geocode("Unifor");
      expect(geoRes).not.toBeNull();
      expect(geoRes?.lat).toBeDefined();
    });
  });

  describe("4. Endereço Não Encontrado", () => {
    it("não deve bloquear nem quebrar quando um endereço for desconhecido, marcando aproximação", async () => {
      const obscureAddress = "Rua Desconhecida das Flores Misteriosas 999";
      const geoRes = await geocodeAddress(obscureAddress);

      expect(geoRes).not.toBeNull();
      expect(geoRes?.rawText).toBe(obscureAddress);
      expect(geoRes?.isApproximate).toBe(true);
      expect(geoRes?.country).toBe("Brasil");
      // Cidade padrão segura
      expect(geoRes?.city).toBeDefined();
    });
  });

  describe("5. Localização Sem Bairro (ex.: Rodovia)", () => {
    it("deve processar e formatar corretamente locais sem bairro definido como Rodovia CE-040", async () => {
      const res = await catalogProvider.search("Rodovia CE-040");
      expect(res.suggestions.length).toBeGreaterThan(0);

      const highway = res.suggestions[0];
      expect(highway.mainText).toContain("Rodovia CE-040");
      expect(highway.neighborhood).toBeUndefined();

      // Formatação não deve quebrar nem exibir 'undefined'
      const formatted = formatLocation({
        rawText: highway.mainText,
        formattedAddress: highway.formattedAddress,
        city: highway.city,
        state: highway.state,
      });

      expect(formatted).not.toContain("undefined");
      expect(formatted).toContain("CE-040");
      expect(formatted).toContain("CE");
    });
  });

  describe("6. Município Diferente da Região Metropolitana", () => {
    it("deve detectar e atribuir corretamente o município de Maracanaú e bairro Pajuçara", async () => {
      const searchRes = await catalogProvider.search("Maracanaú");
      expect(searchRes.suggestions.length).toBeGreaterThan(0);
      expect(searchRes.suggestions[0].city).toBe("Maracanaú");

      const pajucaraNorm = normalizeAddress("Pajuçara, Maracanaú");
      expect(pajucaraNorm.neighborhood).toBe("Pajuçara");
      expect(pajucaraNorm.city).toBe("Maracanaú");

      const pajucaraSolo = normalizeAddress("Bairro Pajuçara");
      expect(pajucaraSolo.neighborhood).toBe("Pajuçara");
      expect(pajucaraSolo.city).toBe("Maracanaú");
    });

    it("deve detectar Caucaia e Eusébio", () => {
      const caucaia = normalizeAddress("Iparana, Caucaia");
      expect(caucaia.city).toBe("Caucaia");

      const eusebio = normalizeAddress("Centro, Eusébio");
      expect(eusebio.city).toBe("Eusébio");
    });
  });

  describe("7. Fallback Manual (Sem Bloquear Formulário)", () => {
    it("deve permitir preenchimento livre e gerar sugestão manual utilizável", async () => {
      const composite = new CompositeGeocodingProvider();
      const freeText = "Meu Condomínio Particular, Aldeota, 123";

      const searchRes = await composite.search(freeText);
      expect(searchRes.suggestions.length).toBeGreaterThan(0);

      const manualSug = searchRes.suggestions[0];
      expect(manualSug.mainText).toBe(freeText);
      expect(manualSug.neighborhood).toBe("Aldeota");
      expect(manualSug.city).toBe("Fortaleza");
      expect(manualSug.state).toBe("CE");
    });
  });

  describe("8. Funções Utilitárias Reutilizáveis", () => {
    it("normalizeAddress: limpa texto e extrai bairro, número e ponto de referência", () => {
      const norm = normalizeAddress("   Av. Washington Soares, 1321 - UNIFOR, Aldeota   ");
      expect(norm.cleanText).toBe("Av. Washington Soares, 1321 - UNIFOR, Aldeota");
      expect(norm.landmark).toBe("Universidade de Fortaleza (UNIFOR)");
      expect(norm.number).toBe("1321");
      expect(norm.state).toBe("CE");
    });

    it("formatLocation: modo aproximado oculta números residenciais para privacidade", () => {
      // Exemplo com número residencial exato: modo aproximado deve higienizar
      const formattedApprox = formatLocation(
        {
          formattedAddress: "Rua Tibúrcio Cavalcante, 1500, Aldeota, Fortaleza - CE",
          neighborhood: "Aldeota",
          city: "Fortaleza",
          state: "CE",
        },
        { privacyMode: "approximate" },
      );

      expect(formattedApprox).toBe("Aldeota — Fortaleza, CE");
      expect(formattedApprox).not.toContain("1500");

      // Modo exato: preserva dados para conferência interna
      const formattedExact = formatLocation(
        {
          formattedAddress: "Rua Tibúrcio Cavalcante, 1500, Aldeota, Fortaleza - CE",
          neighborhood: "Aldeota",
          city: "Fortaleza",
          state: "CE",
        },
        { privacyMode: "exact" },
      );
      expect(formattedExact).toContain("1500");
    });

    it("formatLocation: formata marco de destaque como 'Universidade de Fortaleza — Fortaleza, CE'", () => {
      const formatted = formatLocation({
        landmark: "Universidade de Fortaleza",
        city: "Fortaleza",
        state: "CE",
      });

      expect(formatted).toBe("Universidade de Fortaleza — Fortaleza, CE");
    });

    it("calculateDistance: calcula distância geodésica (Haversine) corretamente", () => {
      const p1 = { lat: -3.7698, lng: -38.4788 }; // UNIFOR
      const p2 = { lat: -3.7638, lng: -38.4815 }; // Centro de Eventos do Ceará

      // Distância entre UNIFOR e Centro de Eventos é aprox. 0.73 km
      const dist = calculateDistance(p1, p2);
      expect(dist).toBeGreaterThan(0.5);
      expect(dist).toBeLessThan(1.2);

      // Mesma coordenada deve retornar 0
      expect(calculateDistance(p1, p1)).toBe(0);
    });

    it("isWithinRadius: valida raio de tolerância geográfico", () => {
      const p1 = { lat: -3.7698, lng: -38.4788 }; // UNIFOR
      const p2 = { lat: -3.7638, lng: -38.4815 }; // Centro de Eventos (~0.73 km)

      expect(isWithinRadius(p1, p2, 1.0)).toBe(true); // Dentro de 1 km
      expect(isWithinRadius(p1, p2, 0.5)).toBe(false); // Fora de 500 m
      expect(isWithinRadius(p1, p2, 0)).toBe(false);
    });
  });

  describe("8. Cobertura Abrangente do Estado do Ceará (Ruas, Bairros e Restaurantes)", () => {
    it("deve encontrar e estruturar ruas residenciais (ex.: Osvaldo Risato em Maracanaú)", async () => {
      const composite = new CompositeGeocodingProvider();
      const res = await composite.search("osvaldo risato");

      expect(res.suggestions.length).toBeGreaterThan(0);
      const street = res.suggestions.find(
        (s) =>
          s.mainText.toLowerCase().includes("osvaldo risato") ||
          s.formattedAddress.toLowerCase().includes("osvaldo risato"),
      );
      expect(street).toBeDefined();
      expect(street?.city).toContain("Maracanaú");
      expect(street?.state).toBe("CE");
      expect(street?.lat).toBeDefined();
      expect(street?.lng).toBeDefined();
    });

    it("deve encontrar e sugerir estabelecimentos/restaurantes no Ceará (ex.: Coco Bambu)", async () => {
      const composite = new CompositeGeocodingProvider();
      const res = await composite.search("coco bambu");

      expect(res.suggestions.length).toBeGreaterThan(0);
      const restaurant = res.suggestions.find(
        (s) =>
          s.mainText.toLowerCase().includes("coco bambu") ||
          s.formattedAddress.toLowerCase().includes("coco bambu"),
      );
      expect(restaurant).toBeDefined();
      expect(restaurant?.lat).toBeDefined();
      expect(restaurant?.lng).toBeDefined();
    }, 12000);

    it("deve reconhecer bairros da região metropolitana e Ceará", async () => {
      const composite = new CompositeGeocodingProvider();
      const res = await composite.search("jardim bandeirante");

      expect(res.suggestions.length).toBeGreaterThan(0);
      const bairro = res.suggestions.find(
        (s) =>
          s.mainText.toLowerCase().includes("jardim bandeirante") &&
          s.city.toLowerCase().includes("maracanaú"),
      );
      expect(bairro).toBeDefined();
    });

    it("deve encontrar e priorizar atacadistas e centros comerciais (ex.: Atacadão Maracanaú)", async () => {
      const composite = new CompositeGeocodingProvider();
      const res = await composite.search("atacadao maracanau");

      expect(res.suggestions.length).toBeGreaterThan(0);
      const topMatch = res.suggestions[0];
      expect(topMatch.mainText).toContain("Atacadão");
      expect(topMatch.city).toBe("Maracanaú");
      expect(topMatch.lat).toBeDefined();
      expect(topMatch.lng).toBeDefined();
    });
  });
});
