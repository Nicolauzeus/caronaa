import {DEPARTMENTS,type DepartmentId} from "./departments";

export type AdminModule = { id:string; label:string; route:string; department:DepartmentId };
export const adminModules:AdminModule[]=DEPARTMENTS.flatMap(department=>
 department.categories.filter(category=>category.phase==="existing"&&category.route).map(category=>({
  id:category.id,label:category.label,route:category.route!,department:department.id
 }))
);
/** Canonical workspaces avoid sending Growth and Partnerships to the same old Relations page. */
const HOMES:Record<DepartmentId,string>={
 executive:"/admin/executivo",technology:"/admin/tecnologia",operations:"/admin/operacoes",
 growth:"/admin/crescimento",research:"/admin/inteligencia-pesquisa",partnerships:"/admin/parcerias",
 safety:"/admin/atendimento",finance:"/admin/financeiro",compliance:"/admin/compliance"
};
export function getDepartmentHome(id:DepartmentId):string{return HOMES[id];}
export function getDepartmentOfPath(pathname:string):DepartmentId|null{
 const path=pathname.replace(/\/$/,"")||"/";
 const matches=adminModules.filter(item=>path===item.route||path.startsWith(item.route+"/"));
 if(!matches.length)return null;
 matches.sort((a,b)=>b.route.length-a.route.length);
 return matches[0].department;
}
export function getModules(id:DepartmentId){
 return adminModules.filter(item=>item.department===id);
}
export function normalizeModuleHash(hash:string):string{
 return hash.replace(/^#/,"");
}
export function findActiveModule(id:DepartmentId,pathname:string,hash:string){
 const modules=getModules(id);
 const key=normalizeModuleHash(hash);
 return modules.find(m=>m.route===pathname&&m.id===key)
 ?? modules.find(m=>m.route===pathname)
 ?? modules[0];
}
