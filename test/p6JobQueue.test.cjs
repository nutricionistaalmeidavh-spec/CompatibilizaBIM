'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createJobQueue}=require('../app/electron/cbimJobQueue.cjs');

test('F6 queue runs one heavy CBIM conversion at a time and preserves terminal state', async()=>{
  let release; const gate=new Promise(r=>release=r); const started=[];
  const queue=createJobQueue(async input=>{started.push(input.name); if(input.name==='a') await gate; return {ok:true,name:input.name};});
  const first=queue.enqueue({name:'a'}); const second=queue.enqueue({name:'b'});
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(started,['a']);
  assert.equal(queue.snapshot()[0].status,'running');
  assert.equal(queue.snapshot()[1].status,'queued');
  release(); await Promise.all([first.promise,second.promise]);
  assert.deepEqual(started,['a','b']);
  assert.deepEqual(queue.snapshot().map(j=>j.status),['completed','completed']);
});

test('F6 queue exposes failed jobs without dropping their error', async()=>{
  const queue=createJobQueue(async()=>{throw new Error('falha controlada')});
  const job=queue.enqueue({name:'x'}); await assert.rejects(job.promise,/falha controlada/);
  assert.equal(queue.snapshot()[0].status,'failed');
  assert.match(queue.snapshot()[0].error,/falha controlada/);
});
