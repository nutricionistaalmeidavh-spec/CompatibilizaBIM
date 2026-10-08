'use strict';
const { randomUUID }=require('node:crypto');

function createJobQueue(worker){
  if(typeof worker!=='function') throw new TypeError('CBIM queue worker is required');
  const jobs=[]; let draining=false;
  async function drain(){
    if(draining) return; draining=true;
    try{
      while(true){
        const job=jobs.find(item=>item.status==='queued'); if(!job) break;
        job.status='running'; job.startedAt=new Date().toISOString();
        try{job.result=await worker(job.input);job.status='completed';job.resolve(job.result)}
        catch(error){job.status='failed';job.error=String(error?.message||error);job.reject(error)}
        finally{job.finishedAt=new Date().toISOString()}
      }
    } finally {draining=false}
  }
  return Object.freeze({
    enqueue(input){
      let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b});
      const job={id:randomUUID(),input,status:'queued',createdAt:new Date().toISOString(),startedAt:null,finishedAt:null,result:null,error:null,resolve,reject,promise};
      jobs.push(job); queueMicrotask(drain);
      return {id:job.id,promise};
    },
    snapshot(){return jobs.map(({resolve,reject,promise,input,...job})=>({...job,label:String(input?.name||input?.input?.name||'Conversão CBIM')}));}
  });
}
module.exports={createJobQueue};
