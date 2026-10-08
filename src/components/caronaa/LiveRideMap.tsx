import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
export type LiveMapPoint={lat:number;lng:number;title:string;type:'driver'|'passenger'|'meeting'|'destination'};
export function LiveRideMap({points}:{points:LiveMapPoint[]}) {
  const container=useRef<HTMLDivElement>(null);
  const map=useRef<LeafletMap|null>(null);
  const layer=useRef<LayerGroup|null>(null);
  const latest=useRef(points);
  latest.current=points;
  useEffect(()=>{
    let active=true;
    void import('leaflet').then(L=>{
      if(!active||!container.current)return;
      const instance=L.map(container.current).setView([-3.73,-38.53],12);
      map.current=instance;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(instance);
      layer.current=L.layerGroup().addTo(instance);
      draw(L,latest.current);
      instance.invalidateSize();
    });
    return ()=>{active=false;map.current?.remove();map.current=null;layer.current=null;};
  },[]);
  function draw(L:typeof import('leaflet'),next:LiveMapPoint[]) {
    if(!map.current||!layer.current)return;
    layer.current.clearLayers();
    next.forEach(p=>{
      const icon=L.divIcon({className:'ride-live-marker',html:`<span class="ride-marker-${p.type}">${p.type==='driver'?'M':p.type==='passenger'?'P':p.type==='meeting'?'E':'D'}</span>`,iconSize:[30,30],iconAnchor:[15,15]});
      L.marker([p.lat,p.lng],{icon}).bindTooltip(p.title,{direction:'top'}).addTo(layer.current as LayerGroup);
    });
    if(next.length)map.current.fitBounds(L.latLngBounds(next.map(p=>[p.lat,p.lng] as [number,number])),{padding:[32,32],maxZoom:16});
  }
  useEffect(()=>{let active=true;void import('leaflet').then(L=>{if(active)draw(L,points);});return ()=>{active=false;};},[points]);
  return <div ref={container} className="h-64 w-full" role="img" aria-label={`Mapa da viagem: ${points.map(p=>p.title).join(', ')}`} />;
}
