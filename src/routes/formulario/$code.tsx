import {createFileRoute} from "@tanstack/react-router";
import {PublicResearchForm} from "@/components/research/PublicResearchForm";
export const Route=createFileRoute("/formulario/$code")({head:({params})=>({meta:[{title:`Pesquisa ${params.code} — CARONAA`},{name:"description",content:"Participe da pesquisa pública de mobilidade CARONAA, sem precisar criar conta."},{property:"og:title",content:`Pesquisa ${params.code} — CARONAA`},{property:"og:description",content:"Pesquisa pública de mobilidade CARONAA."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Page});
function Page(){const {code}=Route.useParams();return <PublicResearchForm key={code} code={code}/>;}
