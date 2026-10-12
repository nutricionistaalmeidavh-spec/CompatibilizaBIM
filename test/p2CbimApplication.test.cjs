'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCbimApplication } = require('../app/electron/cbimApplication.cjs');

test('application layer exposes local commands without leaking runner implementation', async () => {
  const calls=[];
  const app=createCbimApplication({
    convertDwg: async input => { calls.push(['convert', input]); return { needsReview:false }; },
    cancelConversion: () => { calls.push(['cancel']); return true; },
    listWorkspaces: async documents => { calls.push(['list',documents]); return [{path:'w'}]; },
    openStudio: async options => { calls.push(['open',options.workspacePath]); return {opened:true}; },
  });
  assert.deepEqual(await app.execute('StartConversion',{input:{name:'a.dwg'},documentsDir:'docs'}),{needsReview:false});
  assert.equal(await app.execute('CancelConversion',{}),true);
  assert.deepEqual(await app.query('GetHistory',{documentsDir:'docs'}),[{path:'w'}]);
  assert.deepEqual(await app.execute('OpenProject',{workspacePath:'w'}),{opened:true});
  assert.deepEqual(calls.map(x=>x[0]),['convert','cancel','list','open']);
});

test('application layer rejects unknown commands and queries', async () => {
  const app=createCbimApplication({convertDwg:async()=>{},cancelConversion:()=>{},listWorkspaces:async()=>[],openStudio:async()=>{}});
  await assert.rejects(()=>app.execute('Mutation',{ }),/Unsupported CBIM command/);
  await assert.rejects(()=>app.query('Render',{ }),/Unsupported CBIM query/);
});
