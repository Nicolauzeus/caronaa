import {describe,expect,it} from "vitest";
import {distanceMeters,forgetVerifiedGpsCity,rememberVerifiedGpsCity,verifiedGpsCity} from "./professional-radar-geo-cache";

describe("F07 server municipality GPS cache",()=>{
 it("reuses server-verified city for less than 300m and less than 3 minutes",()=>{
  const user="cache-driver-01",at=1000000;
  rememberVerifiedGpsCity(user,{lat:-4.225,lng:-38.71},"Redenção",at);
  expect(verifiedGpsCity(user,{lat:-4.2258,lng:-38.71},at+179999)).toBe("Redenção");
  expect(verifiedGpsCity(user,{lat:-4.2258,lng:-38.71},at+180001)).toBeNull();
  forgetVerifiedGpsCity(user);
 });
 it("rejects coordinates outside verified radius and isolates different users",()=>{
  const at=2000000;
  rememberVerifiedGpsCity("driver-a",{lat:-4.225,lng:-38.71},"Redenção",at);
  expect(distanceMeters({lat:-4.225,lng:-38.71},{lat:-4.23,lng:-38.71})).toBeGreaterThan(300);
  expect(verifiedGpsCity("driver-a",{lat:-4.23,lng:-38.71},at+100)).toBeNull();
  expect(verifiedGpsCity("driver-b",{lat:-4.225,lng:-38.71},at+100)).toBeNull();
  forgetVerifiedGpsCity("driver-a");
 });
});
