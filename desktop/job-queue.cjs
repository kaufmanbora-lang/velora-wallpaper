const {randomUUID}=require('node:crypto');

// Every installation owns its queue. No file, API key or task is sent to Velora servers.
class JobQueue {
  constructor({capacity=4,historyLimit=12,onChange=()=>{}}={}) {
    this.capacity=capacity;
    this.historyLimit=historyLimit;
    this.onChange=onChange;
    this.jobs=[];
    this.active=null;
    this.latest=null;
    this.closed=false;
  }
  enqueue({key,sourceId,label,run}) {
    if(this.closed)throw new Error('Приложение завершает работу.');
    const existing=this.jobs.find(j=>!j.done&&j.key===key);
    if(existing)return {id:existing.id,duplicate:true};
    if(this.jobs.filter(j=>!j.done).length>=this.capacity)
      throw new Error('Очередь заполнена: 1 обработка и до 3 ожидающих. Дождитесь результата или отмените задание.');
    const job={id:randomUUID(),key,sourceId,label,run,controller:new AbortController(),status:'queued',stage:'В очереди',progress:null,done:false};
    this.jobs.push(job);
    this.onChange();
    queueMicrotask(()=>this.drain());
    return {id:job.id,duplicate:false};
  }
  async drain() {
    if(this.active||this.closed)return;
    const job=this.jobs.find(j=>!j.done&&j.status==='queued');
    if(!job)return;
    this.active=job;
    job.status='running';
    job.stage='Подготовка…';
    this.onChange();
    try {
      job.controller.signal.throwIfAborted();
      job.outputId=await job.run(job);
      job.controller.signal.throwIfAborted();
      job.stage='Готово';job.progress=100;job.status='done';
    } catch(error) {
      job.error=job.controller.signal.aborted
        ? 'Обработка отменена. Уже отправленный запрос мог тарифицироваться Google.'
        : String(error?.message||error);
      job.stage='Обработка остановлена';
      job.status=job.controller.signal.aborted?'canceled':'error';
    } finally {
      job.done=true;delete job.run;this.active=null;this.latest=job;
      this.prune();
      this.onChange();
      queueMicrotask(()=>this.drain());
    }
  }
  cancel(id=this.active?.id) {
    const job=this.jobs.find(j=>j.id===id&&!j.done);
    if(!job)return;
    job.controller.abort();
    if(job.status==='queued') {
      job.done=true;job.status='canceled';job.stage='Отменено до отправки';
      delete job.run;
    }
    this.prune();
    this.onChange();
  }
  prune(){
    const completed=this.jobs.filter(j=>j.done);
    const discard=new Set(completed.slice(0,Math.max(0,completed.length-this.historyLimit)));
    this.jobs=this.jobs.filter(j=>!discard.has(j));
  }
  hasSource(id) { return this.jobs.some(j=>!j.done&&j.sourceId===id); }
  current() { return this.active||this.jobs.find(j=>!j.done)||this.latest||this.jobs.at(-1); }
  shutdown() { this.closed=true;for(const job of this.jobs)if(!job.done)this.cancel(job.id); }
}

// Import and desktop changes also cannot create unbounded parallel subprocesses.
class ExclusiveGate {
  constructor(){this.running=new Set();}
  async run(group,fn){
    if(this.running.has(group))throw new Error('Дождитесь завершения предыдущего действия.');
    this.running.add(group);
    try{return await fn();}finally{this.running.delete(group);}
  }
}
module.exports={JobQueue,ExclusiveGate};
