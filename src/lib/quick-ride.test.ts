import { describe, expect, it } from "vitest";
import { quickRideActions } from "./quick-ride";

describe("quickRideActions", () => {
  it("passageiro só pode cancelar enquanto busca", () => {
    expect(quickRideActions("PASSENGER", "SEARCHING")).toEqual(["CANCEL"]);
  });
  it("passageiro confirma embarque quando o motorista chegou", () => {
    expect(quickRideActions("PASSENGER", "ARRIVED")).toEqual(["CANCEL", "CONFIRM_PICKUP"]);
  });
  it("motorista segue aceito → chegou → em viagem → concluída", () => {
    expect(quickRideActions("DRIVER", "ACCEPTED")).toEqual(["CANCEL", "ARRIVED"]);
    expect(quickRideActions("DRIVER", "ARRIVED")).toEqual(["CANCEL", "IN_PROGRESS"]);
    expect(quickRideActions("DRIVER", "IN_PROGRESS")).toEqual(["COMPLETED"]);
  });
  it("corrida em viagem não pode ser cancelada e concluída não tem ações", () => {
    expect(quickRideActions("PASSENGER", "IN_PROGRESS")).toEqual([]);
    expect(quickRideActions("DRIVER", "COMPLETED")).toEqual([]);
  });
});
