import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT=path.resolve('research/slot-time-300ms-boundary')
const INPUT=path.join(OUT,'analysis.json'), OUTPUT=path.join(OUT,'stability-analysis.json'), MARKDOWN=path.join(OUT,'stability-analysis.md')
type WindowPair={before:any;after:any;beforeBuckets:any[];afterBuckets:any[]}
type Metric={key:string;label:string;kind:'rate'|'relative';read:(pair:WindowPair)=>number|null}
const metrics:Metric[]=[
 {key:'success_rate',label:'Success rate',kind:'rate',read:p=>p.after.success.rate-p.before.success.rate},
 {key:'failure_rate',label:'Failure rate',kind:'rate',read:p=>p.after.failure.rate-p.before.failure.rate},
 {key:'failed_cu_share',label:'Failed-CU share',kind:'rate',read:p=>p.after.computeUnits.failedCuShare-p.before.computeUnits.failedCuShare},
 {key:'median_cu_per_tx',label:'Median CU per transaction',kind:'relative',read:p=>relative(p.before.computeUnits.distribution.median,p.after.computeUnits.distribution.median)},
 {key:'p90_cu_per_tx',label:'P90 CU per transaction',kind:'relative',read:p=>relative(p.before.computeUnits.distribution.p90,p.after.computeUnits.distribution.p90)},
 {key:'p95_cu_per_tx',label:'P95 CU per transaction',kind:'relative',read:p=>relative(p.before.computeUnits.distribution.p95,p.after.computeUnits.distribution.p95)},
 {key:'median_cost_units_per_tx',label:'Median cost units per transaction',kind:'relative',read:p=>relative(p.before.costUnits.distribution.median,p.after.costUnits.distribution.median)},
 {key:'p90_cost_units_per_tx',label:'P90 cost units per transaction',kind:'relative',read:p=>relative(p.before.costUnits.distribution.p90,p.after.costUnits.distribution.p90)},
 {key:'p95_cost_units_per_tx',label:'P95 cost units per transaction',kind:'relative',read:p=>relative(p.before.costUnits.distribution.p95,p.after.costUnits.distribution.p95)},
 {key:'median_priority_fee',label:'Median reconstructed priority fee',kind:'relative',read:p=>relative(p.before.priorityFeeLamports.distribution.median,p.after.priorityFeeLamports.distribution.median)},
 {key:'median_nonvote_tx_per_block',label:'Median non-vote transactions per block',kind:'relative',read:p=>relative(p.before.perBlock.transactions.median,p.after.perBlock.transactions.median)},
 {key:'median_nonvote_cu_per_block',label:'Median non-vote CU per block',kind:'relative',read:p=>relative(p.before.perBlock.nonVoteCu.median,p.after.perBlock.nonVoteCu.median)},
 {key:'median_cu_utilization',label:'Median all-landed CU utilization',kind:'relative',read:p=>relative(p.before.perBlock.allLandedCuUtilization.median,p.after.perBlock.allLandedCuUtilization.median)},
]
const feeMetrics=['total fees','success fees','failure fees']
const relative=(before:number|null,after:number|null)=>before==null||after==null||before===0?null:(after-before)/before
const sign=(value:number|null,kind:Metric['kind'])=>value==null?null:Math.abs(value)<(kind==='rate'?0.01:0.05)?0:value>0?1:-1
const numberAt=(candidate:unknown)=>typeof candidate==='number'&&Number.isFinite(candidate)?candidate:null
function sideValue(metric:Metric, side:any) {
 switch(metric.key) {
  case 'success_rate': return numberAt(side.success?.rate)
  case 'failure_rate': return numberAt(side.failure?.rate)
  case 'failed_cu_share': return numberAt(side.computeUnits?.failedCuShare)
  case 'median_cu_per_tx': return numberAt(side.computeUnits?.distribution?.median)
  case 'p90_cu_per_tx': return numberAt(side.computeUnits?.distribution?.p90)
  case 'p95_cu_per_tx': return numberAt(side.computeUnits?.distribution?.p95)
  case 'median_cost_units_per_tx': return numberAt(side.costUnits?.distribution?.median)
  case 'p90_cost_units_per_tx': return numberAt(side.costUnits?.distribution?.p90)
  case 'p95_cost_units_per_tx': return numberAt(side.costUnits?.distribution?.p95)
  case 'median_priority_fee': return numberAt(side.priorityFeeLamports?.distribution?.median)
  case 'median_nonvote_tx_per_block': return numberAt(side.perBlock?.transactions?.median)
  case 'median_nonvote_cu_per_block': return numberAt(side.perBlock?.nonVoteCu?.median)
  case 'median_cu_utilization': return numberAt(side.perBlock?.allLandedCuUtilization?.median)
  default: return null
 }
}
function bucketRange(metric:Metric, buckets:any[]) {
 const values=buckets.map(bucket=>sideValue(metric,bucket)).filter((value):value is number=>value!=null)
 return values.length<2?null:Math.max(...values)-Math.min(...values)
}
async function atomic(file:string,value:unknown){const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file)}
function pair(report:any,key:string){const value=report[key];if(!value?.before||!value?.after)throw new Error(`Missing completed evidence: ${key}`);return value as WindowPair}
async function main(){
 const report=JSON.parse(await readFile(INPUT,'utf8'))
 let feeEnrichment:any=null
 try { feeEnrichment=JSON.parse(await readFile(path.join(OUT,'fee-enrichment.json'),'utf8')) } catch { /* enrichment has not yet been run */ }
 const windows={unbuffered_1h:pair(report,'primary60Minutes'),unbuffered_3h:pair(report,'robustness3Hours'),unbuffered_6h:pair(report,'extended6Hours'),buffered_6h:pair(report.bufferedVariants,'extended6Hours')}
 const rows=metrics.map(metric=>{
  const changes=Object.fromEntries(Object.entries(windows).map(([name,p])=>[name,metric.read(p)]))
  const signs=Object.fromEntries(Object.entries(changes).map(([name,value])=>[name,sign(value,metric.kind)]))
  const bucketVariation=Object.fromEntries(Object.entries(windows).map(([name,p])=>{
   const beforeRange=bucketRange(metric,p.beforeBuckets), afterRange=bucketRange(metric,p.afterBuckets)
   const rawBefore=sideValue(metric,p.before), rawAfter=sideValue(metric,p.after)
   const rawDelta=rawBefore==null||rawAfter==null?null:rawAfter-rawBefore
   const floor=beforeRange==null||afterRange==null?null:Math.max(beforeRange,afterRange)
   return [name,{beforeRange,afterRange,floor,rawDelta,passes:rawDelta!=null&&floor!=null&&Math.abs(rawDelta)>floor}]
  }))
  const core=[signs.unbuffered_1h,signs.unbuffered_3h,signs.unbuffered_6h],buffer=signs.buffered_6h
  const directionPass=!core.includes(null)&&!core.includes(0)&&buffer!==null&&buffer!==0&&new Set([...core,buffer]).size===1
  const variationPass=Object.values(bucketVariation).every((entry:any)=>entry.passes)
  const classification=core.includes(null)||buffer===null?'INSUFFICIENT_EVIDENCE':directionPass&&variationPass?'STABLE_SAMPLED_LEDGER_SIGNAL':'UNSTABLE_NOISY'
  return {metric:metric.key,label:metric.label,kind:metric.kind,changes,signs,bucketVariation,directionPass,variationPass,classification}
 })
 const feeTreatment=feeEnrichment?.completed?{classification:'OBSERVED_TOP_ONE_PERCENT_TRIMMING_SENSITIVITY',metrics:feeMetrics,sensitivity:feeEnrichment.sensitivity,scope:feeEnrichment.scope}:{classification:'OUTLIER_SENSITIVITY_REQUIRED',metrics:feeMetrics,reason:'Raw fee totals cannot qualify as stable. Deterministic transaction-fee enrichment of the fixed sampled blocks is required to check the pre-registered top-1% trimming sensitivity.'}
 const output={generatedAt:new Date().toISOString(),scope:'Pre-registered active stability read: unbuffered 1h, 3h, 6h plus buffered 6h. 12h is deferred.',thresholds:{rateAbsolutePercentagePoints:1,relativePercent:5,bucketVariation:'Absolute raw before/after delta must exceed max(before bucket range, after bucket range) in every active comparison.'},feeTreatment,results:rows,provenance:{analysis:INPUT,preregistration:path.join(OUT,'stability-preregistration.md'),feeEnrichment:path.join(OUT,'fee-enrichment.json')}}
 await atomic(OUTPUT,output)
 await writeFile(MARKDOWN,`# Pre-registered stability classification\n\nThis file is generated only after the 6-hour unbuffered and buffered evidence is complete. A metric must have the same non-zero direction across all four comparisons **and**, in each comparison, its absolute raw before/after change must exceed the greater within-side six-bucket range. It applies the fixed criteria in [stability-preregistration.md](stability-preregistration.md).\n\n| Metric | 1h | 3h | 6h | 6h buffered | Direction | Bucket variation | Classification |\n| --- | ---: | ---: | ---: | ---: | --- | --- | --- |\n${rows.map(row=>`| ${row.label} | ${format(row.changes.unbuffered_1h,row.kind)} | ${format(row.changes.unbuffered_3h,row.kind)} | ${format(row.changes.unbuffered_6h,row.kind)} | ${format(row.changes.buffered_6h,row.kind)} | ${row.directionPass ? 'pass' : 'fail'} | ${row.variationPass ? 'pass' : 'fail'} | ${row.classification} |`).join('\n')}\n\nFee totals are never eligible for a stable-signal label. A deterministic transaction-fee enrichment of the same selected blocks supplies the separate top-1% trimming sensitivity check.\n`)
}
function format(value:number|null,kind:Metric['kind']){if(value==null)return 'null';return kind==='rate'?`${(value*100).toFixed(2)} pp`:`${(value*100).toFixed(2)}%`}
void main()
