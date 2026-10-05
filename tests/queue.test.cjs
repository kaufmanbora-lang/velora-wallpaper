const {test}=require('node:test'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const {JobQueue,ExclusiveGate}=require('../desktop/job-queue.cjs');
const {providerRequest}=require('../desktop/provider-request.cjs');
async function idle(q){for(let i=0;i<1000&&q.jobs.some(j=>!j.done);i++)await delay(1);assert.ok(q.jobs.every(j=>j.done));}

test('one worker, bounded queue, duplicate click coalescing and FIFO',async()=>{
  const q=new JobQueue(),order=[];let active=0,peak=0;
  const run=async j=>{peak=Math.max(peak,++active);order.push(j.sourceId);await delay(3);active--;return j.sourceId;};
  const first=q.enqueue({key:'a',sourceId:'a',run});
  for(let i=0;i<1000;i++)assert.equal(q.enqueue({key:'a',run}).id,first.id);
  for(const key of ['b','c','d'])q.enqueue({key,sourceId:key,run});
  assert.throws(()=>q.enqueue({key:'overflow',run}),/Очередь заполнена/);
  await idle(q);assert.equal(peak,1);assert.deepEqual(order,['a','b','c','d']);
});
test('queued cancellation never executes, failed work releases worker',async()=>{
  const q=new JobQueue();let started=0;
  q.enqueue({key:'a',run:async()=>{await delay(5);throw new Error('fixture failure');}});
  const pending=q.enqueue({key:'b',run:()=>{started++;}});
  q.cancel(pending.id);
  q.enqueue({key:'c',run:()=>{started++;return 'c';}});
  await idle(q);assert.equal(started,1);assert.equal(q.jobs[0].status,'error');assert.equal(q.jobs[1].status,'canceled');assert.equal(q.jobs[2].outputId,'c');
});
test('canceling active work holds slot until cleanup and shutdown blocks new work',async()=>{
  const q=new JobQueue();let cleaned=false;
  const first=q.enqueue({key:'a',run:async j=>{try{await delay(1000,null,{signal:j.controller.signal});}finally{await delay(3);cleaned=true;}}});
  q.enqueue({key:'b',run:()=>{assert.ok(cleaned);return 'b';}});
  await delay(1);q.cancel(first.id);await idle(q);assert.equal(q.jobs[0].status,'canceled');
  q.shutdown();assert.throws(()=>q.enqueue({key:'c',run:()=>{}}),/завершает работу/);
});
test('read retries use jitter and Retry-After, paid submissions retry only explicit 429',async()=>{
  let calls=0;const waits=[];
  assert.equal(await providerRequest(async()=>{calls++;if(calls<3)throw {status:429,headers:{'retry-after':'5'}};return 'ok';},{random:()=>0.5,sleep:async ms=>waits.push(ms)}),'ok');
  assert.deepEqual(waits,[5000,5000]);
  for(const status of [0,400,401,403,500,503]){
    calls=0;await assert.rejects(providerRequest(async()=>{calls++;throw Object.assign(new Error('failed'),{status});},{sleep:async()=>{}}));assert.equal(calls,1);
  }
  calls=0;await providerRequest(async()=>{if(++calls===1)throw {status:503};},{readOnly:true,sleep:async()=>{}});assert.equal(calls,2);
});
test('retry waits are cancelable; retry budget and long Retry-After are bounded',async()=>{
  const c=new AbortController();let calls=0;
  await assert.rejects(providerRequest(async()=>{calls++;throw {status:429};},{signal:c.signal,sleep:async()=>c.abort()}));assert.equal(calls,1);
  calls=0;await assert.rejects(providerRequest(async()=>{calls++;throw {status:429};},{sleep:async()=>{}}));assert.equal(calls,4);
  calls=0;await assert.rejects(providerRequest(async()=>{calls++;throw {status:429,headers:{'retry-after':'3600'}};}));assert.equal(calls,1);
});
test('exclusive action gate rejects parallel imports and recovers after failure',async()=>{
  const gate=new ExclusiveGate();const first=gate.run('imports',()=>delay(5));
  await assert.rejects(gate.run('imports',()=>{}));await first;
  await assert.rejects(gate.run('imports',()=>{throw new Error('failed');}));
  assert.equal(await gate.run('imports',()=>42),42);
});
test('repeated cancellation cannot grow queue history without bound',()=>{
  const q=new JobQueue();for(let i=0;i<1000;i++){const j=q.enqueue({key:String(i),run:()=>{throw new Error('Canceled work ran');}});q.cancel(j.id);}
  assert.ok(q.jobs.length<=12);q.shutdown();
});
