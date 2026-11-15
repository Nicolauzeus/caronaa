import { describe, expect, it } from "vitest";
import { formatGeoJsonLineString } from "./road-routing";

describe("formatGeoJsonLineString / PostGIS-compatible WGS84",()=>{
  it("serializes as GeoJSON [longitude,latitude] in route order",()=>{
    expect(formatGeoJsonLineString([
      {lat:-3.731,lng:-38.521},
      {lat:-3.742,lng:-38.515},
    ])).toEqual({
      type:"LineString",
      coordinates:[[-38.521,-3.731],[-38.515,-3.742]],
    });
  });
  it("rejects invalid or too-short route geometry",()=>{
    expect(()=>formatGeoJsonLineString([{lat:-3.73,lng:-38.52}])).toThrow(/Geometria/);
    expect(()=>formatGeoJsonLineString([{lat:91,lng:0},{lat:0,lng:0}])).toThrow(/Geometria/);
    expect(()=>formatGeoJsonLineString([{lat:0,lng:Infinity},{lat:0,lng:0}])).toThrow(/Geometria/);
  });
});
