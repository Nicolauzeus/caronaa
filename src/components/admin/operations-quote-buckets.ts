/**
 * Turns any valid date window into at most seven chronological chart rows.
 * All quote events remain included in the summed rows; only the visualization
 * is compacted. The underlying daily data, summary and exported PDFs remain raw.
 */
export type QuoteDayPoint={day:string;quotes_generated:number};
export type QuoteChartBucket={startDay:string;endDay:string;quotes:number};
export function groupQuoteDaysForChart(
  days:readonly QuoteDayPoint[],
  maximumBars=7,
):QuoteChartBucket[]{
  const ordered=[...days].sort((a,b)=>a.day.localeCompare(b.day));
  if(ordered.length===0)return [];
  const count=Math.min(Math.max(1,Math.floor(maximumBars)),ordered.length);
  return Array.from({length:count},(_,index)=>{
    const start=Math.floor(index*ordered.length/count);
    const end=Math.floor((index+1)*ordered.length/count);
    const segment=ordered.slice(start,end);
    return {
      startDay:segment[0].day,
      endDay:segment[segment.length-1].day,
      quotes:segment.reduce((sum,day)=>sum+day.quotes_generated,0),
    };
  });
}
export function formatQuoteDate(day:string):string {
  return day.slice(8,10)+"/"+day.slice(5,7);
}
