import {InsightChart} from "@/components/admin/InsightChart";
import type {ChartDatum} from "@/lib/admin/chart-utils";
export function ResearchChart({title,rows,description}:{title:string;rows:ChartDatum[];description?:string}){
 return <InsightChart title={title} rows={rows} description={description} metricLabel="Respostas"/>;
}
