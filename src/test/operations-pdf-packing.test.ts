import { describe, expect, it } from "vitest";
import { packPdf } from "@/components/admin/operations-pdf-file";
function read(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsText(blob);});
}
describe("operations PDF packing",()=>{
 for(const n of [2,3]){
  it("builds unique page/stream objects and valid xref offsets for "+n+" pages",async()=>{
   // ASCII dummy image bytes isolate packing; rendering is a separate browser test.
   const pdf=await read(packPdf(Array.from({length:n},()=>new Uint8Array([65,66,67])),842,595));
   const last=3+3*n;
   expect(pdf).toContain("/Count "+n+" >>");
   expect(pdf).toContain("/Size "+(last+1)+" /Root");
   const xref=pdf.indexOf("xref\n");
   expect(xref).toBeGreaterThan(0);
   const lines=pdf.slice(xref).split("\n");
   expect(lines[1]).toBe("0 "+(last+1));
   for(let id=1;id<=last;id++){
    const offset=Number(lines[2+id].slice(0,10));
    expect(pdf.slice(offset)).toMatch(new RegExp("^"+id+" 0 obj"));
   }
   expect(Number(pdf.match(/startxref\n(\d+)/)?.[1])).toBe(xref);
  });
 }
});
