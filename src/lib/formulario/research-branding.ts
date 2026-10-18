export const RESEARCH_BRAND_IMAGE_MAX_BYTES=2*1024*1024;
export const RESEARCH_BRAND_IMAGE_TYPES:Record<string,string>={
 "image/png":"png","image/jpeg":"jpg","image/webp":"webp"
};
export function validateResearchBrandImage(type:string,size:number):string|null{
 if(!RESEARCH_BRAND_IMAGE_TYPES[type])return "Escolha uma imagem PNG, JPG ou WebP.";
 if(!Number.isFinite(size)||size<=0||size>RESEARCH_BRAND_IMAGE_MAX_BYTES)return "A imagem deve ter até 2 MB e não pode estar vazia.";
 return null;
}
