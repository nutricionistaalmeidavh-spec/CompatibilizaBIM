import React from 'react';
import { createRoot } from 'react-dom/client';
const host=document.querySelector<HTMLDivElement>('#app');
if(!host)throw new Error('CompatibilizaBIM renderer host not found.');
const root=createRoot(host);
const isReview=new URLSearchParams(location.search).get('surface')==='review';
if(isReview){
  Promise.all([import('./studio/StudioApp'),import('./studio/studio-react.css')])
    .then(([{StudioApp}])=>root.render(<React.StrictMode><StudioApp/></React.StrictMode>))
    .catch(e=>root.render(<main role="alert">Falha ao abrir revisão: {String(e.message||e)}</main>));
}else{
  Promise.all([import('./shell/AppShell'),import('./studio.css')])
    .then(([{AppShell}])=>root.render(<React.StrictMode><AppShell/></React.StrictMode>))
    .catch(e=>root.render(<main role="alert">Falha ao abrir Studio: {String(e.message||e)}</main>));
}
