import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function ListPagination({page,total,pageSize=8,onChange}:{page:number;total:number;pageSize?:number;onChange:(page:number)=>void}) {
 const pages=Math.max(1,Math.ceil(total/pageSize));
 return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 text-sm text-muted-foreground"><span>{total ? `${page*pageSize+1}–${Math.min((page+1)*pageSize,total)} de ${total}` : '0 registros'}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={page===0} onClick={()=>onChange(page-1)}><ChevronLeft size={16}/></Button><span>Página {page+1} de {pages}</span><Button variant="outline" size="icon" aria-label="Próxima página" disabled={page+1>=pages} onClick={()=>onChange(page+1)}><ChevronRight size={16}/></Button></div></div>;
}
