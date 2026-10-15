import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { buildPixPayload } from '@/lib/pix';

export function DriverPixSettings() {
  const [key,setKey] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let active=true;
    void supabase.rpc('get_my_pix_key').then(({data,error})=>{
      if (!active) return;
      if(error) toast.error('Não foi possível carregar sua chave Pix.');
      else setKey(data ?? '');
      setLoading(false);
    });
    return ()=>{active=false;};
  },[]);
  return <section className="mb-6 border-b border-border pb-6" aria-label="Pix do motorista">
    <h2 className="mb-3 text-lg font-semibold">Pix do motorista</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={async e=>{
      e.preventDefault();setBusy(true);
      const {error}=await supabase.rpc('save_my_pix_key',{p_key:key.trim()});
      setBusy(false);
      if(error) toast.error(error.message); else toast.success('Chave Pix salva.');
    }}>
      <div className="min-w-0 flex-1 basis-64"><Label htmlFor="driver-pix">Chave Pix</Label><Input id="driver-pix" value={key} disabled={loading} maxLength={77} onChange={e=>setKey(e.target.value)} placeholder="CPF, CNPJ, e-mail, +55 ou chave aleatória" /></div>
      <Button disabled={loading||busy} type="submit">{busy?'Salvando…':'Salvar Pix'}</Button>
    </form>
  </section>;
}
export function CompletedRidePix({rideId}:{rideId:string}) {
  const [data,setData]=useState<{key:string|null;name:string;amount:number}|null>(null);
  const [image,setImage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data:result,error}=await supabase.rpc('get_ride_pix',{p_ride_id:rideId});
      if(error) { if(active)setError('Não foi possível carregar o Pix.');return; }
      const pix=result as unknown as {key:string|null;name:string;amount:number};
      if(active)setData(pix);
      if(pix.key){
        const url=await QRCode.toDataURL(buildPixPayload(pix.key,pix.name,Number(pix.amount)),{width:240,margin:2});
        if(active)setImage(url);
      }
    })().catch(()=>{if(active)setError('Não foi possível gerar o Pix.');});
    return ()=>{active=false;};
  },[rideId]);
  if(error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if(!data) return <p role="status" className="text-sm text-muted-foreground">Carregando Pix…</p>;
  if(!data.key) return <p className="text-sm text-muted-foreground">Motorista ainda não cadastrou a chave Pix.</p>;
  return <div className="flex flex-col items-center gap-3 py-4" aria-label="Pix da viagem concluída">
    {image&&<img src={image} alt="QR Code Pix do motorista" width={240} height={240} className="max-w-full rounded-md"/>}
    <p className="max-w-full break-all text-center font-mono text-sm">{data.key}</p>
  </div>;
}
