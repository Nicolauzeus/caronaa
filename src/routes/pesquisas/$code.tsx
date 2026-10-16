import {createFileRoute} from "@tanstack/react-router";
import {PublicResearchForm} from "@/components/research/PublicResearchForm";
export const Route=createFileRoute("/pesquisas/$code")({component:Page});
function Page(){const {code}=Route.useParams();return <PublicResearchForm code={code}/>;}
