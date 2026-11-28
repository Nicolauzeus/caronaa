import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
describe("CARONAA opaque black launcher icons",()=>{
  for(const [path,size] of [["public/pwa-icon-192.png",192],["public/pwa-icon-512.png",512],["android/app/src/main/res/drawable/caronaa_icon.png",512],["native-shell/icon.png",512]] as const) {
    it(path,()=>{
      const bytes=readFileSync(path);
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
      expect(bytes[24]).toBe(8);
      expect(bytes[25]).toBe(2); // opaque RGB, no transparent launcher backing
      const chunks:Buffer[]=[];
      for(let i=8;i<bytes.length;){const len=bytes.readUInt32BE(i);if(bytes.toString("ascii",i+4,i+8)==="IDAT")chunks.push(bytes.subarray(i+8,i+8+len));i+=len+12;}
      const raw=inflateSync(Buffer.concat(chunks));
      expect(raw.length).toBe(size*(size*3+1));
      expect([...raw.subarray(1,4)]).toEqual([0,0,0]);
    });
  }
});
