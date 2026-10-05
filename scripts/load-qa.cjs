const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {setTimeout:delay}=require('node:timers/promises');
const {JobQueue}=require('../desktop/job-queue.cjs');
const {providerRequest}=require('../desktop/provider-request.cjs');

(async()=>{
 const clients=1000,queues=[];let running=0,peak=0,completed=0,duplicates=0,rejected=0,retries=0;
 const started=performance.now();
 for(let client=0;client<clients;client++){
  const q=new JobQueue();queues.push(q);let localRunning=0;
  const run=async job=>{
   assert.equal(++localRunning,1);peak=Math.max(peak,++running);
   try{
    let calls=0;
    await providerRequest(async()=>{if(client%10===0&&calls++===0)throw {status:429};await delay(5);},
      {signal:job.controller.signal,sleep:async()=>{retries++;await delay(1);}});
    completed++;return client+':'+job.key;
   }finally{localRunning--;running--;}
  };
  const first=q.enqueue({key:'same-operation',sourceId:'image',run});
  for(let click=0;click<20;click++){
   const duplicate=q.enqueue({key:'same-operation',run});assert.equal(duplicate.id,first.id);assert.ok(duplicate.duplicate);duplicates++;
  }
  for(let j=0;j<3;j++)q.enqueue({key:'variant-'+j,sourceId:'image',run});
  try{q.enqueue({key:'overflow',run});}catch{rejected++;}
 }
 while(queues.some(q=>q.jobs.some(j=>!j.done))){
  if(performance.now()-started>30000)throw new Error('Simulated client queues did not drain');
  await delay(10);
 }
 assert.equal(completed,4000);assert.equal(duplicates,20000);assert.equal(rejected,1000);assert.equal(retries,400);
 assert.equal(peak,1000);assert.equal(running,0);
 assert.ok(queues.every(q=>q.jobs.every(j=>j.status==='done')));
 const report={scenario:'1000 isolated desktop client queues, mocked provider; no Google requests, no real video processing',clients,acceptedJobs:4000,completedJobs:completed,duplicateClicksCoalesced:duplicates,overflowRequestsRejected:rejected,transient429Retries:retries,peakSimultaneousClientWorkers:peak,maxWorkersPerClient:1,maxOutstandingPerClient:4,elapsedMs:Math.round(performance.now()-started),realCloudThroughputVerified:false};
 await fs.mkdir('.qa',{recursive:true});await fs.writeFile('.qa/load-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exit(1);});
