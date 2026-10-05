const {setTimeout:delay}=require('node:timers/promises');

function statusOf(error){return Number(error?.status||error?.statusCode||error?.response?.status)||0;}
function retryAfter(error,now=Date.now()){
  const headers=error?.headers||error?.response?.headers;
  const value=headers?.get?.('retry-after')||headers?.['retry-after'];
  if(value==null)return 0;
  const seconds=Number(value);
  return Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(value)-now)||0;
}

async function providerRequest(operation,{signal,stage=()=>{},readOnly=false,attempts=4,sleep=delay,random=Math.random}={}){
  for(let attempt=0;attempt<attempts;attempt++){
    signal?.throwIfAborted();
    try{return await operation();}catch(error){
      signal?.throwIfAborted();
      const status=statusOf(error);
      // Never resubmit paid generation after an ambiguous timeout/network/5xx error.
      // Only an explicit 429 is retried for submissions; reads can be retried safely.
      const retryable=status===429||(readOnly&&(status===0||status===408||status>=500&&status<=599));
      const advised=retryAfter(error);
      if(!retryable||attempt===attempts-1||advised>120000)throw error;
      const wait=Math.max(advised,Math.min(30000,2000*2**attempt)*(0.75+random()*0.5));
      stage(`Google занят · повтор через ${Math.ceil(wait/1000)} с (${attempt+1}/${attempts-1})`);
      await sleep(wait,null,{signal});
    }
  }
}
module.exports={providerRequest,statusOf,retryAfter};
