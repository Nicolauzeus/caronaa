import {createFileRoute} from "@tanstack/react-router";
import {PublicResearchForm} from "@/components/research/PublicResearchForm";
export const Route=createFileRoute("/pesquisas/$code")({head:({params})=>({meta:[{title:`Questionário ${params.code} — CARONAA`},{name:"description",content:"Responda ao questionário público de mobilidade CARONAA sem cadastro."},{property:"og:title",content:`Questionário ${params.code} — CARONAA`},{property:"og:description",content:"Questionário público de mobilidade CARONAA."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Page});
function Page(){const {code}=Route.useParams();return <PublicResearchForm key={code} code={code}/>;}
