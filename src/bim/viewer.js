function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function point(value) {
  return [0, 1, 2].map((index) => Number(value?.[index]) || 0);
}

export function criarManifestoViewer(modelos = [], conflitos = []) {
  const elementos = modelos.flatMap((modelo) => (modelo.elementos ?? []).map((elemento) => ({
    ...elemento,
    disciplina: elemento.disciplina || modelo.disciplina,
    sourceFile: elemento.sourceFile || modelo.arquivo_nome || modelo.nome,
  })));
  const all = elementos.flatMap((elemento) => [point(elemento.bbox?.min), point(elemento.bbox?.max)]);
  const min = all.length ? [0, 1, 2].map((index) => Math.min(...all.map((item) => item[index]))) : [0, 0, 0];
  const max = all.length ? [0, 1, 2].map((index) => Math.max(...all.map((item) => item[index]))) : [1, 1, 1];
  return {
    version: 3,
    origin: min.map((value, index) => (value + max[index]) / 2),
    bounds: { minimum: min, maximum: max },
    disciplines: [...new Set(elementos.map((elemento) => elemento.disciplina || 'não definida'))],
    elements: elementos,
    clashes: conflitos,
  };
}

export function gerarViewerFederadoHtml(manifesto) {
  const data = safeJson(manifesto);
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Engenharia 360 · Viewer BIM federado</title>
<style>
 :root{color-scheme:dark;font:14px Inter,system-ui,sans-serif;background:#0b1117;color:#edf4f8}*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#0b1117}body{display:grid;grid-template-columns:minmax(300px,360px) 1fr}aside{padding:22px;background:#14202b;border-right:1px solid #2b4050;overflow:auto}main{position:relative;min-width:0;min-height:0;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 40%,#172631,#0b1117 70%)}canvas#c{display:none}canvas#gl{position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;cursor:grab;background:transparent}canvas#gl.dragging{cursor:grabbing}h1{font-size:22px;margin:0 0 8px}h2{font-size:16px;margin:24px 0 10px}.eyebrow{font-size:11px;letter-spacing:.14em;color:#82d4ad;font-weight:800}.muted{color:#9fb2bf;font-size:12px;line-height:1.45}.model{padding:10px 0;border-top:1px solid #2b4050}.model strong{display:block;color:#fff}.pill{display:inline-block;border:1px solid #466477;border-radius:99px;padding:3px 7px;margin:4px 4px 0 0;font-size:11px;color:#b9d4e1}.list button,.actions button{width:100%;display:block;margin:7px 0;padding:10px 11px;border:1px solid #466477;border-radius:8px;background:#203747;color:#f2f8fb;text-align:left;cursor:pointer}.list button:hover,.actions button:hover{background:#2b4b5d}.list button.active{border-color:#78d6a0;box-shadow:0 0 0 1px #78d6a0 inset}.clash{padding:12px;border:1px solid #385263;border-radius:9px;background:#1a2b37;text-align:left;cursor:pointer;color:#fff}.clash b{display:block}.clash small{display:block;color:#a9bfcb;margin-top:4px}.clash.high{border-left:4px solid #ff7373}.clash.medium{border-left:4px solid #f1bd67}.clash.low{border-left:4px solid #78d6a0}.hint{position:absolute;left:18px;bottom:18px;padding:9px 12px;border-radius:8px;background:#14202bcc;border:1px solid #385263;color:#bcd0da;font-size:12px;pointer-events:none}.canvas-actions{position:absolute;top:16px;right:18px;display:flex;gap:8px;z-index:2}.canvas-actions button{border:1px solid #466477;border-radius:8px;background:#14202b;color:#fff;padding:9px 12px;cursor:pointer}.empty{padding:12px;border:1px dashed #466477;color:#9fb2bf;border-radius:8px}.viewer-error{position:absolute;left:18px;right:18px;top:18px;z-index:3;padding:12px 14px;border:1px solid #ff7373;border-radius:8px;background:#3a1d25;color:#ffd9dc;line-height:1.4}
</style><aside><p class="eyebrow">COMPATIBILIDADE BIM</p><h1>Viewer 3D federado</h1><p class="muted">Modelo completo ajustado automaticamente. Arraste para orbitar, use a roda para zoom e clique em um conflito para enquadrar os elementos envolvidos.</p><h2>Modelos</h2><div id="models"></div><h2>Disciplinas</h2><div id="disc" class="list"></div><h2>Conflitos <span id="count" class="pill"></span></h2><div id="clash" class="list"></div></aside><main><canvas id="c" aria-hidden="true"></canvas><canvas id="gl" aria-label="Modelo BIM em 3D"></canvas><div id="viewerError" class="viewer-error" hidden></div><div class="canvas-actions"><button id="fit">Enquadrar tudo</button><button id="png">Salvar PNG</button></div><div class="hint">Arraste para orbitar · roda para zoom · clique em um conflito para centralizar</div></main>
<script>(()=>{
  'use strict';
  const d=${data}; window.__viewerManifest=d;
  const canvas=document.querySelector('#c');
  const ctx=canvas?.getContext('2d');
  const errorBox=document.querySelector('#viewerError');
  const showError=(message)=>{if(errorBox){errorBox.textContent=message;errorBox.hidden=false;}};
  if(!canvas||!ctx){showError('Não foi possível inicializar a área 3D. Gere o viewer novamente.');return;}
  window.addEventListener('error',()=>showError('Ocorreu um erro ao desenhar o modelo. Gere o viewer novamente ou verifique o arquivo IFC.'));
  window.addEventListener('unhandledrejection',()=>showError('Ocorreu um erro ao processar o modelo. Verifique se os arquivos IFC estão íntegros.'));
  const initialElement=new URLSearchParams(location.hash.replace(/^#/,'')).get('element');
  let yaw=.68,pitch=.43,zoom=1,target=Array.isArray(d.origin)?d.origin.slice(0,3):[0,0,0],drag=false,pointerId=null,last=[0,0],selected=new Set(initialElement?[initialElement]:[]),hidden=new Set();
  let viewport={width:1,height:1,ratio:1};
  const colors=['#71b8ff','#78d6a0','#f3b562','#d28cff','#ff7f8e'];
  const disciplines=[...new Set((d.elements??[]).map((element)=>element.disciplina||'Não definida'))];
  const models=[...new Map((d.elements??[]).map((element)=>[element.sourceFile||'modelo',element.sourceFile||'modelo'])).keys()];
  const $=(id)=>document.getElementById(id);
  function resize(){
    const rect=canvas.getBoundingClientRect();
    const width=Math.max(1,rect.width||1),height=Math.max(1,rect.height||1),ratio=Math.min(Math.max(window.devicePixelRatio||1,1),2.5);
    const pixelWidth=Math.max(1,Math.round(width*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    ctx.setTransform(ratio,0,0,ratio,0,0);viewport={width,height,ratio};
  }
  function size(){return [viewport.width,viewport.height];}
  function bounds(ids){
    const elements=(d.elements??[]).filter((element)=>!ids||ids.has(element.globalId));
    if(!elements.length)return {min:(d.bounds?.minimum??[0,0,0]).slice(),max:(d.bounds?.maximum??[0,0,0]).slice()};
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    elements.forEach((element)=>{const box=element.bbox||{};const mn=box.min||[0,0,0],mx=box.max||[0,0,0];for(let index=0;index<3;index++){const a=Number(mn[index])||0,b=Number(mx[index])||0;min[index]=Math.min(min[index],a,b);max[index]=Math.max(max[index],a,b);}});
    return {min,max};
  }
  function fit(ids){
    resize();
    const box=bounds(ids),range=box.max.map((value,index)=>Math.max(0,Number(value)-Number(box.min[index]))),radius=Math.max(Math.hypot(...range),.25);
    target=[0,1,2].map((index)=>(Number(box.min[index])+Number(box.max[index]))/2);
    const [width,height]=size();zoom=Math.max(.05,Math.min(10000,Math.min(width,height)/(radius*2.15)));draw();
  }
  function project(value){
    const a=(Number(value[0])||0)-target[0],b=(Number(value[1])||0)-target[1],z=(Number(value[2])||0)-target[2],ca=Math.cos(yaw),sa=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),xx=a*ca-b*sa,yy=a*sa+b*ca,depth=z*cp-yy*sp;const [width,height]=size();return [width/2+xx*zoom,height/2-depth*zoom];
  }
  function severity(conflict){return conflict.gravidade||((Number(conflict.distanciaM||0)===0)?'high':'medium');}
  function clashText(conflict){const mode=conflict.modo==='clearance'?'afastamento insuficiente':conflict.modo==='collision'?'colisão geométrica':'interseção geométrica';return {title:(conflict.aNome||conflict.aGlobalId||'Elemento A')+' × '+(conflict.bNome||conflict.bGlobalId||'Elemento B'),summary:'Foi identificada '+mode+' entre os elementos.',detail:Number(conflict.distanciaM||0)===0?'Os volumes ocupam a mesma região.':'Distância mínima: '+Number(conflict.distanciaM).toFixed(3)+' m.'};}
  function drawBox(element){
    const box=element.bbox||{},mn=box.min||[0,0,0],mx=box.max||[0,0,0],vertices=[[mn[0],mn[1],mn[2]],[mx[0],mn[1],mn[2]],[mx[0],mx[1],mn[2]],[mn[0],mx[1],mn[2]],[mn[0],mn[1],mx[2]],[mx[0],mn[1],mx[2]],[mx[0],mx[1],mx[2]],[mn[0],mx[1],mx[2]]].map(project),edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],color=colors[Math.max(0,disciplines.indexOf(element.disciplina))%colors.length],hot=selected.has(element.globalId);
    ctx.strokeStyle=hot?'#ff4545':color;ctx.lineWidth=hot?4:Math.max(1.25,1.8/viewport.ratio);ctx.globalAlpha=hot?1:.8;ctx.lineJoin='round';
    edges.forEach((edge)=>{ctx.beginPath();ctx.moveTo(vertices[edge[0]][0],vertices[edge[0]][1]);ctx.lineTo(vertices[edge[1]][0],vertices[edge[1]][1]);ctx.stroke();});
    if(hot){const label=project([(Number(mn[0])+Number(mx[0]))/2,(Number(mn[1])+Number(mx[1]))/2,Number(mx[2])]);ctx.fillStyle='#fff';ctx.font='600 13px system-ui';ctx.fillText(element.name||element.globalId||'Elemento',label[0]+7,label[1]-7);}
  }
  function draw(){
    try{resize();const [width,height]=size();ctx.globalAlpha=1;ctx.clearRect(0,0,width,height);ctx.fillStyle='#0b1117';ctx.fillRect(0,0,width,height);(d.elements??[]).filter((element)=>!hidden.has(element.disciplina)).sort((a,b)=>(a.bbox?.min?.[2]||0)-(b.bbox?.min?.[2]||0)).forEach(drawBox);ctx.globalAlpha=1;}
    catch(error){showError('Ocorreu um erro ao desenhar o modelo. Gere o viewer novamente ou verifique o arquivo IFC.');}
  }
  function renderSide(){
    $('models').innerHTML=models.length?models.map((model)=>'<div class="model"><strong>'+model+'</strong><span class="muted">'+(d.elements??[]).filter((element)=>(element.sourceFile||'modelo')===model).length+' elementos</span></div>').join(''):'<div class="empty">Nenhum modelo carregado.</div>';
    $('disc').innerHTML=disciplines.map((value,index)=>'<button data-disc="'+value+'"><span style="color:'+colors[index%colors.length]+'">●</span> '+value+'</button>').join('');
    document.querySelectorAll('[data-disc]').forEach((button)=>button.addEventListener('click',()=>{const key=button.dataset.disc;hidden.has(key)?hidden.delete(key):hidden.add(key);button.classList.toggle('active',hidden.has(key));draw();}));
    $('count').textContent=(d.clashes??[]).length+' encontrados';
    $('clash').innerHTML=(d.clashes??[]).length?(d.clashes??[]).map((conflict,index)=>{const text=clashText(conflict),level=severity(conflict);return '<button class="clash '+level+'" data-clash="'+index+'"><b>#'+(index+1)+' · '+text.title+'</b><small>'+text.summary+' '+text.detail+'</small></button>';}).join(''):'<div class="empty">Nenhum conflito carregado.</div>';
    document.querySelectorAll('[data-clash]').forEach((button)=>button.addEventListener('click',()=>{const conflict=d.clashes[Number(button.dataset.clash)],ids=new Set([conflict.aGlobalId,conflict.bGlobalId].filter(Boolean));selected=ids;fit(ids.size?ids:undefined);document.querySelectorAll('[data-clash]').forEach((item)=>item.classList.remove('active'));button.classList.add('active');}));
  }
  $('fit').addEventListener('click',()=>{selected=new Set();fit();});
  $('png').addEventListener('click',()=>{try{const link=document.createElement('a');link.download='viewer-bim-alta-resolucao.png';link.href=canvas.toDataURL('image/png');link.click();}catch(error){showError('Não foi possível exportar a imagem PNG.');}});
  canvas.addEventListener('pointerdown',(event)=>{if(event.button!==0)return;drag=true;pointerId=event.pointerId;last=[event.clientX,event.clientY];canvas.classList.add('dragging');canvas.setPointerCapture?.(pointerId);});
  canvas.addEventListener('pointermove',(event)=>{if(!drag||event.pointerId!==pointerId)return;yaw+=(event.clientX-last[0])*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(event.clientY-last[1])*.008));last=[event.clientX,event.clientY];draw();});
  const endDrag=(event)=>{if(pointerId!==null&&event.pointerId!==pointerId)return;drag=false;pointerId=null;canvas.classList.remove('dragging');};
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',()=>{drag=false;pointerId=null;canvas.classList.remove('dragging');});
  canvas.addEventListener('click',(event)=>{if(drag)return;const rect=canvas.getBoundingClientRect();const x=event.clientX-rect.left,y=event.clientY-rect.top;let best=null,distance=Infinity;(d.elements??[]).forEach((element)=>{const box=element.bbox||{},center=[((Number(box.min?.[0])||0)+(Number(box.max?.[0])||0))/2,((Number(box.min?.[1])||0)+(Number(box.max?.[1])||0))/2,((Number(box.min?.[2])||0)+(Number(box.max?.[2])||0))/2],point=project(center),distanceNow=Math.hypot(point[0]-x,point[1]-y);if(distanceNow<distance){distance=distanceNow;best=element;}});if(best&&distance<36){selected=new Set([best.globalId]);history.replaceState(null,'','#element='+encodeURIComponent(best.globalId));draw();}});
  canvas.addEventListener('wheel',(event)=>{event.preventDefault();const factor=Math.exp(-event.deltaY*.0015);zoom=Math.max(.05,Math.min(10000,zoom*factor));draw();},{passive:false});
  window.addEventListener('resize',()=>requestAnimationFrame(draw));
  renderSide();requestAnimationFrame(()=>fit());
})()</script><script>(()=>{
  const data=window.__viewerManifest||{}, canvas=document.getElementById('gl'), gl=canvas&&canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true}), errorBox=document.getElementById('viewerError');
  const fail=(message)=>{if(errorBox){errorBox.textContent=message;errorBox.hidden=false;}};
  if(!gl){fail('WebGL não está disponível neste computador. Atualize o driver gráfico ou use o visualizador simplificado.');return;}
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Falha no shader');return shader;};
  let program;try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec3 p;uniform mat4 mvp;void main(){gl_Position=mvp*vec4(p,1.0);}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'precision mediump float;uniform vec4 color;void main(){gl_FragColor=color;}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Falha ao montar renderer WebGL');}catch(error){fail(error.message);return;}
  const locP=gl.getAttribLocation(program,'p'),locMvp=gl.getUniformLocation(program,'mvp'),locColor=gl.getUniformLocation(program,'color');
  const vertices=new Float32Array([-0.5,-0.5,-0.5,0.5,-0.5,-0.5,0.5,0.5,-0.5,-0.5,0.5,-0.5,-0.5,-0.5,0.5,0.5,-0.5,0.5,0.5,0.5,0.5,-0.5,0.5,0.5]);
  const indices=new Uint16Array([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,4,0,3,4,3,7]);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const colors=['#71b8ff','#78d6a0','#f3b562','#d28cff','#ff7f8e'];const rgb=(hex)=>{const n=parseInt(hex.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
  const disciplines=[...new Set((data.elements||[]).map((e)=>e.disciplina||'Não definida'))];
  const objects=(data.elements||[]).map((e)=>{const mn=(e.bbox&&e.bbox.min)||[0,0,0],mx=(e.bbox&&e.bbox.max)||[1,1,1],center=[(Number(mn[0])+Number(mx[0]))/2,(Number(mn[1])+Number(mx[1]))/2,(Number(mn[2])+Number(mx[2]))/2],size=[Math.max(Math.abs(Number(mx[0])-Number(mn[0])),.02),Math.max(Math.abs(Number(mx[1])-Number(mn[1])),.02),Math.max(Math.abs(Number(mx[2])-Number(mn[2])),.02)],id=e.globalId||e.id||Math.random().toString(36),color=rgb(colors[Math.max(0,disciplines.indexOf(e.disciplina))%colors.length]);return{e,id,center,size,color};});
  const selected=new Set(new URLSearchParams(location.hash.replace(/^#/,'')).get('element')?[new URLSearchParams(location.hash.replace(/^#/,'')).get('element')]:[]),hidden=new Set();let yaw=.68,pitch=.43,dist=10,target=[0,0,0],drag=false,pointerId=null,last=[0,0],viewport={width:1,height:1};
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=(a)=>{const l=Math.hypot(...a)||1;return a.map((v)=>v/l)};
  function mul(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];out[c*4+r]=s;}return out;}
  function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),out=new Float32Array(16);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=(2*far*near)/(near-far);return out;}
  function view(){const cp=Math.cos(pitch),eye=[target[0]+dist*cp*Math.cos(yaw),target[1]+dist*cp*Math.sin(yaw),target[2]+dist*Math.sin(pitch)],z=norm(sub(eye,target)),x=norm(cross([0,0,1],z)),y=cross(z,x),out=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);return out;}
  function model(o){const [sx,sy,sz]=o.size,[x,y,z]=o.center;return new Float32Array([sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1]);}
  function transform(m,p){const x=p[0],y=p[1],z=p[2];return[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[3]*x+m[7]*y+m[11]*z+m[15]];}
  function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(Math.max(devicePixelRatio||1,1),2.5),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);viewport={width:rect.width||1,height:rect.height||1,ratio};}
  function fit(ids){const list=objects.filter((o)=>!ids||ids.has(o.id));if(!list.length)return;const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];list.forEach((o)=>[0,1,2].forEach((i)=>{mn[i]=Math.min(mn[i],o.center[i]-o.size[i]/2);mx[i]=Math.max(mx[i],o.center[i]+o.size[i]/2);}));target=mn.map((v,i)=>(v+mx[i])/2);dist=Math.max(Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])*1.7,.5);draw();}
  function draw(){resize();gl.enable(gl.DEPTH_TEST);gl.clearColor(.043,.067,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.enableVertexAttribArray(locP);gl.vertexAttribPointer(locP,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);const projection=perspective(Math.PI/4,Math.max(canvas.width/canvas.height,.1),.01,Math.max(dist*100,1000)),camera=view();for(const o of objects){if(hidden.has(o.e.disciplina))continue;const mvp=mul(projection,mul(camera,model(o)));gl.uniformMatrix4fv(locMvp,false,mvp);const c=selected.has(o.id)?[1,.18,.12]:o.color;gl.uniform4f(locColor,c[0],c[1],c[2],selected.has(o.id)?1:.82);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);}}
  function project(point){const mvp=mul(perspective(Math.PI/4,Math.max(canvas.width/canvas.height,.1),.01,Math.max(dist*100,1000)),view()),p=transform(mvp,point);if(!p[3])return[Infinity,Infinity];return[(p[0]/p[3]*.5+.5)*viewport.width,(1-(p[1]/p[3]*.5+.5))*viewport.height];}
  document.getElementById('fit')?.addEventListener('click',()=>{selected.clear();fit();});document.getElementById('png')?.addEventListener('click',()=>{try{const a=document.createElement('a');a.download='viewer-bim-webgl.png';a.href=canvas.toDataURL('image/png');a.click();}catch(error){fail('Não foi possível exportar a imagem WebGL.');}});
  document.querySelectorAll('[data-clash]').forEach((button)=>button.addEventListener('click',()=>{const c=(data.clashes||[])[Number(button.dataset.clash)],ids=new Set([c?.aGlobalId,c?.bGlobalId].filter(Boolean));selected.clear();ids.forEach((id)=>selected.add(id));fit(ids); }));
  document.querySelectorAll('[data-disc]').forEach((button)=>button.addEventListener('click',()=>{const key=button.dataset.disc;hidden.has(key)?hidden.delete(key):hidden.add(key);draw();}));
  canvas.addEventListener('pointerdown',(event)=>{if(event.button!==0)return;drag=true;pointerId=event.pointerId;last=[event.clientX,event.clientY];canvas.classList.add('dragging');canvas.setPointerCapture?.(pointerId);});
  canvas.addEventListener('pointermove',(event)=>{if(!drag||event.pointerId!==pointerId)return;yaw+=(event.clientX-last[0])*.008;pitch=Math.max(-1.35,Math.min(1.35,pitch+(event.clientY-last[1])*.008));last=[event.clientX,event.clientY];draw();});
  const end=(event)=>{if(pointerId!==null&&event.pointerId!==pointerId)return;drag=false;pointerId=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',()=>{drag=false;pointerId=null;canvas.classList.remove('dragging');});
  canvas.addEventListener('click',(event)=>{if(drag)return;const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let hit=null,best=Infinity;objects.forEach((o)=>{if(hidden.has(o.e.disciplina))return;const p=project(o.center),distanceNow=Math.hypot(p[0]-x,p[1]-y);if(distanceNow<best){best=distanceNow;hit=o;}});if(hit&&best<42){selected.clear();selected.add(hit.id);history.replaceState(null,'','#element='+encodeURIComponent(hit.id));draw();}});
  canvas.addEventListener('wheel',(event)=>{event.preventDefault();dist=Math.max(.1,Math.min(1e7,dist*Math.exp(event.deltaY*.0015)));draw();},{passive:false});window.addEventListener('resize',()=>requestAnimationFrame(draw));requestAnimationFrame(()=>fit());
})()</script></html>`;
}
