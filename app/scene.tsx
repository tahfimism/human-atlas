import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type Part,type SceneState} from './anatomy';
const chunkBufferCache = new Map<number, ArrayBuffer>();
interface Props {atlas:Atlas;state:SceneState;priorityChunks?:number[];onSelect:(id:string)=>void;onIsolatePart?:(id:string|null)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void}
export default function AnatomyScene({atlas,state,priorityChunks,onSelect,onIsolatePart,onProgress,onError}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),select=useRef(onSelect),isolateRef=useRef(onIsolatePart);
 latest.current=state;select.current=onSelect;isolateRef.current=onIsolatePart;
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false,lastView='',lastReset=-1,lastIsolate='',layoutKey='',amount=0;
  let lastState:SceneState|null=null;
  const abort=new AbortController();
  let renderer:T.WebGLRenderer;
  const isTrans=typeof window!=='undefined'&&(window.location.search.includes('transparent=true')||window.location.search.includes('snapshot=true')); try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});}catch{onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));if(isTrans){renderer.setClearColor(0x000000,0);}else{renderer.setClearColor('#f2f3f3');}renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.localClippingEnabled=true;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  camera.position.set(0,1.05,3.6);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.05;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',()=>{dirty=true;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0x64748b,0.75));
  const key=new T.DirectionalLight(0xfffaf4,1.35);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xe9f0ff,0.75);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshStandardMaterial({color:0xd5d9dc,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0xeeeeec,metalness:.04,roughness:.72}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:0x8c969f,transparent:true,opacity:.4,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:0xa4aeb8,transparent:true,opacity:.16,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[],centers=atlas.parts.map(p=>new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
  const offsets:T.Vector3[]=[],bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  let packingWidth=1,packingHeight=1;
  const markerPositions=new Float32Array(atlas.parts.length*3),markerGeometry=new T.BufferGeometry();markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
  const markerMaterial=new T.PointsMaterial({color:0x64748b,size:5,sizeAttenuation:false,transparent:true,opacity:.72,depthTest:false});
  markerMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  const markers=new T.Points(markerGeometry,markerMaterial);markers.frustumCulled=false;markers.renderOrder=10;markers.visible=false;scene.add(markers);
  const hover=document.createElement('div');hover.className='part-hover';hover.setAttribute('role','tooltip');hover.hidden=true;el.appendChild(hover);
  const labelsContainer=document.createElement('div');labelsContainer.className='anatomy-labels';el.appendChild(labelsContainer);
  interface LandmarkPin {element:HTMLDivElement;partIndex:number;}
  let currentPins:LandmarkPin[]=[];
  const clipPlane=new T.Plane(new T.Vector3(0,0,-1),10000);
  type Target={index:number;x:number;y:number;left:number;right:number;top:number;bottom:number};let targets:Target[]=[];
  const projected=new T.Vector3();
  const findTarget=(x:number,y:number,radius:number)=>{
   let best=-1,score=Infinity;
   for(const t of targets){const dx=Math.max(t.left-x,0,x-t.right),dy=Math.max(t.top-y,0,y-t.bottom),distance=Math.hypot(dx,dy);if(distance>radius)continue;const candidate=distance+Math.hypot(t.x-x,t.y-y)*.025;if(candidate<score){score=candidate;best=t.index;}}
   return best;
  };
  const materialFor=(system:string)=>{
   const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.01,roughness:.62,side:T.DoubleSide,clippingPlanes:[clipPlane],clipShadows:true,transparent:system==='integumentary',opacity:system==='integumentary'?.1:1,depthWrite:system!=='integumentary'});
   m.onBeforeCompile=shader=>{
    shader.uniforms.partState={value:partTexture};shader.uniforms.selectionState={value:selectionTexture};shader.uniforms.stateWidth={value:width};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;');
    shader.fragmentShader='varying float partVisible; varying float partSelected;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.85, 0.95), partSelected * 0.7) + vec3(0.08, 0.22, 0.28) * partSelected;');
   };materials.push(m);return m;
  };
  const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));
  const fitOrgan=(view:string)=>{
   const s=latest.current;
   const isolateIds=s.isolatedParts&&s.isolatedParts.length>0?s.isolatedParts:s.selected;
   if(!isolateIds||!isolateIds.length)return;
   const isolateSet=new Set(isolateIds);
   const box=new T.Box3();
   atlas.parts.forEach((p,i)=>{if(isolateSet.has(p.id))box.union(bounds[i]);});
   if(box.isEmpty())return;
   const center=box.getCenter(new T.Vector3());
   const size=box.getSize(new T.Vector3());
   const fovRad=T.MathUtils.degToRad(camera.fov/2);
   const aspect=Math.max(0.1,camera.aspect);
   const distV=(size.y/2)/Math.tan(fovRad);
   const distH=(size.x/2)/(Math.tan(fovRad)*aspect);
   const distD=(size.z/2)/Math.tan(fovRad);
   const distance=Math.max(0.12,Math.max(distV,distH,distD)*1.35);
   controls.target.copy(center);
   controls.maxDistance=Math.max(20,distance*3);
   controls.minDistance=0.05;
   const direction=view==='back'?new T.Vector3(0,0,-1):view==='side'?new T.Vector3(1,0,0):new T.Vector3(0,0,1);
   camera.position.copy(center).addScaledVector(direction,distance);
   camera.clearViewOffset();
   controls.update();
   dirty=true;
  };
  const fit=(view:string,extent=0)=>{
   if(latest.current.isolate){fitOrgan(view);return;}
   const aspect=camera.aspect,mobile=el.clientWidth<768,normalDistance=mobile?Math.max(4.5,1.8*el.clientHeight/Math.max(160,el.clientHeight-350)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))):4;
   const reservedHeight=mobile?350:270;const availableAspect=Math.max(.35,(el.clientWidth-(mobile?40:340))/Math.max(160,el.clientHeight-reservedHeight));const atlasDistance=Math.max(packingHeight,packingWidth/availableAspect)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*(el.clientHeight/Math.max(160,el.clientHeight-reservedHeight))*1.08;
   const distance=T.MathUtils.lerp(normalDistance,Math.max(.2,atlasDistance),extent);if(extent>.8)view='front';
   const direction=view==='back'?new T.Vector3(0,.02,-1):view==='side'?new T.Vector3(1,.02,0):new T.Vector3(0,.02,1);
   controls.target.set(extent>.1&&el.clientWidth>767?-packingWidth*.12:0,extent>.1||mobile?.85:.68,0);camera.position.copy(controls.target).addScaledVector(direction,distance);controls.update();dirty=true;
  };
  if(state.isolate){fitOrgan(state.view);}else{fit(state.view,0);}
  let loaded=0;
  const loadedChunks=new Set<number>();
  const loadChunk=async(ci:number)=>{
   if(loadedChunks.has(ci)||disposed)return;loadedChunks.add(ci);
   let buffer = chunkBufferCache.get(ci);
   if(!buffer){
    const chunk=atlas.chunks[ci],compressed=!!chunk.gzip&&typeof DecompressionStream!=='undefined';
    const response=await fetch(compressed?chunk.gzip!:chunk.url,{signal:abort.signal});
    buffer=await decodeModelResponse(response,chunk.bytes,compressed);
    if(disposed)return;
    chunkBufferCache.set(ci,buffer);
   }
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer!,p.positions,p.vertexCount*3),3));
    g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer!,p.normals,p.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer!,p.indices,p.indexCount),1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));
    const list=groups.get(p.system)??[];list.push(g);groups.set(p.system,list);
   });
   groups.forEach((gs,system)=>{const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Could not assemble anatomy geometry.');geometries.push(geometry);const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;scene.add(mesh);});
   lastState=null;loaded++;const goal=priorityChunks?.length||atlas.chunks.length;onProgress(Math.min(100,Math.round(loaded/goal*100)));dirty=true;
  };
  (async()=>{
   try{
    const primary=priorityChunks&&priorityChunks.length>0?[...new Set(priorityChunks)]:Array.from({length:atlas.chunks.length},(_,i)=>i);
    let cursor=0;
    await Promise.all(Array.from({length:Math.min(3,primary.length)},async()=>{
     while(cursor<primary.length){const i=primary[cursor++];await loadChunk(i);}
    }));
    if(!disposed){ready=true;dirty=true;if(latest.current.isolate){fitOrgan(latest.current.view);}onProgress(100);}
   }catch(e){if(!disposed)onError(e instanceof Error?e.message:'Could not load the anatomy.');}
  })();
  const resize=()=>{layoutKey='';lastState=null;renderer.setPixelRatio(Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);if(latest.current.isolate){fitOrgan(latest.current.view);}else{fit(latest.current.view,amount);}};const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),worldBox=new T.Box3(),hitPoint=new T.Vector3();
  const down=(e:PointerEvent)=>{hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);};
  const move=(e:PointerEvent)=>{
   tap.move(e.pointerId,e.clientX,e.clientY);
   const s=latest.current;
   if(e.buttons||(!s.isolate&&amount<.5)||e.pointerType==='touch'||s.mode==='quiz'){hover.hidden=true;return;}
   const rect=el.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,index=findTarget(x,y,16);
   hover.hidden=index<0;renderer.domElement.style.cursor=index<0?'grab':'pointer';
   if(index>=0){
    hover.textContent=atlas.parts[index].name;
    hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-260))}px`;
    hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-55))}px`;
   }
  };
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
  const pickPartAt=(clientX:number,clientY:number,isTouch=false)=>{
   const rect=renderer.domElement.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   let nearest=Infinity,found=-1;const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);
   pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5||(hasSolid&&atlas.parts[i].system==='integumentary'))return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}});
   if(found<0&&(amount>.45||latest.current.isolate))found=findTarget(clientX-rect.left,clientY-rect.top,isTouch?24:16);
   return found;
  };
  let lastTapTime=0,lastTapPos={x:0,y:0};
  const up=(e:PointerEvent)=>{
   const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready)return;
   const now=performance.now();
   const isTouch=e.pointerType==='touch';
   const dist=Math.hypot(e.clientX-lastTapPos.x,e.clientY-lastTapPos.y);
   const isDoubleTap=isTouch&&(now-lastTapTime<350)&&(dist<28);
   const found=pickPartAt(e.clientX,e.clientY,isTouch);
   if(isDoubleTap){
    lastTapTime=0;
    if(found>=0){hover.hidden=true;isolateRef.current?.(atlas.parts[found].id);}
    else{isolateRef.current?.(null);}
   }else{
    lastTapTime=now;
    lastTapPos={x:e.clientX,y:e.clientY};
    if(found>=0){hover.hidden=true;select.current(atlas.parts[found].id);}
   }
  };
  const dblClick=(e:MouseEvent)=>{
   if(!ready)return;
   const found=pickPartAt(e.clientX,e.clientY,false);
   if(found>=0){hover.hidden=true;isolateRef.current?.(atlas.parts[found].id);}
   else{isolateRef.current?.(null);}
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('dblclick',dblClick);
  const clock=new T.Clock();let lastExtent=-1;
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),s=latest.current;
   const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate||lastState?.isolatedParts!==s.isolatedParts||lastState?.sliceActive!==s.sliceActive||lastState?.sliceAxis!==s.sliceAxis||lastState?.sliceValue!==s.sliceValue||lastState?.mode!==s.mode;
   const moving=Math.abs(amount-s.explode)>.0001;
   if(moving){amount=T.MathUtils.damp(amount,s.explode,8,dt);dirty=true;}
   const isolateIds=s.isolatedParts&&s.isolatedParts.length>0?s.isolatedParts:s.selected;
   const isolateSet=new Set(isolateIds);
   if(changed||moving||lastExtent<0){
    const visible=new Set(s.visible),selection=new Set(s.selected);
    const visibleParts=atlas.parts.filter(p=>s.isolate?isolateSet.has(p.id):visible.has(p.system)||selection.has(p.id));
    const nextLayoutKey=visibleParts.map(p=>p.id).join(',')+':'+camera.aspect.toFixed(3);
    if(nextLayoutKey!==layoutKey){const layout=createExplosionLayout(visibleParts,camera.aspect);packingWidth=layout.width;packingHeight=layout.height;atlas.parts.forEach((p,i)=>{const cell=layout.cells.get(p.id);offsets[i]=cell?new T.Vector3(cell.x,cell.y+.85,0):centers[i].clone();});layoutKey=nextLayoutKey;if(amount>.05&&!s.isolate)fit(s.view,Math.max(0,(amount-.3)/.7));}

    atlas.parts.forEach((p,i)=>{
     const c=centers[i],destination=offsets[i];let dx=0,dy=0,dz=0;
     if(amount<=.45){const t=amount/.45;const group=SYSTEMS.findIndex(sys=>sys.id===p.system);const angle=group/SYSTEMS.length*Math.PI*2;dx=Math.sin(angle)*t*.48;dy=(c.y-.85)*t*.28;dz=Math.cos(angle)*t*.48;}
     else {const t=(amount-.45)/.55,group=SYSTEMS.findIndex(sys=>sys.id===p.system),angle=group/SYSTEMS.length*Math.PI*2;dx=T.MathUtils.lerp(Math.sin(angle)*.48,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-.85)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*.48,-c.z,t);}
     const selected=selection.has(p.id);
     const isVisible=s.isolate?isolateSet.has(p.id):(visible.has(p.system)||selected);
     data.set([dx,dy,dz,isVisible?1:0],i*4);
     selectedData[i*4]=selected?255:0;
     markerPositions.set(data[i*4+3]>.5?[c.x+dx,c.y+dy,c.z+dz]:[10000,10000,10000],i*3);const mesh=pickers[i];if(mesh){mesh.position.set(dx,dy,dz);mesh.updateMatrix();mesh.updateMatrixWorld(true);}
    });partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;markerGeometry.attributes.position.needsUpdate=true;lastState=s;lastExtent=amount;dirty=true;
   }
   if(!s.isolate&&(!priorityChunks||priorityChunks.length===0)&&loadedChunks.size<atlas.chunks.length){for(let ci=0;ci<atlas.chunks.length;ci++){if(!loadedChunks.has(ci))void loadChunk(ci);}}
   if(s.view!==lastView||s.reset!==lastReset){
    if(s.isolate){fitOrgan(s.view);}else{fit(s.view,amount);}
    lastView=s.view;lastReset=s.reset;
   }
   if(moving&&!s.isolate)fit(amount>.5?'front':s.view,Math.max(0,(amount-.3)/.7));
   const isolateKey=s.isolate?isolateIds.join(',')+':'+s.reset+':'+s.inspectorOpen+':'+camera.aspect:'';
   if(isolateKey!==lastIsolate||(s.isolate&&moving)){
    if(s.isolate){
     fitOrgan(s.view);
     labelsContainer.innerHTML='';
     currentPins=[];
     const partsWithIdx=isolateIds.map(id=>{const idx=atlas.parts.findIndex(p=>p.id===id);return idx>=0?{idx,part:atlas.parts[idx]}:null;}).filter((x):x is {idx:number;part:Part}=>x!==null);
     const bySys=new Map<string,typeof partsWithIdx>();
     partsWithIdx.forEach(item=>{const list=bySys.get(item.part.system)||[];list.push(item);bySys.set(item.part.system,list);});
     const landmarkIndices:number[]=[];
     bySys.forEach(list=>{list.sort((a,b)=>b.part.vertexCount-a.part.vertexCount);landmarkIndices.push(list[0].idx);if(list.length>5&&(list[0].part.system==='cardiac'||list[0].part.system==='arterial')&&list[1]){landmarkIndices.push(list[1].idx);}});
     if(landmarkIndices.length<3&&partsWithIdx.length>1){const sorted=[...partsWithIdx].sort((a,b)=>b.part.vertexCount-a.part.vertexCount);for(const item of sorted){if(!landmarkIndices.includes(item.idx)){landmarkIndices.push(item.idx);if(landmarkIndices.length>=4)break;}}}
     landmarkIndices.slice(0,5).forEach(idx=>{
      const p=atlas.parts[idx];const sysColor=SYSTEMS.find(sys=>sys.id===p.system)?.color??'#527c9f';
      const pin=document.createElement('div');pin.className='anatomy-pin';
      pin.innerHTML=`<div class="anatomy-pin-dot" style="background:${sysColor}"></div><div class="anatomy-pin-badge"><span class="anatomy-pin-system-dot" style="background:${sysColor}"></span><span class="anatomy-pin-name">${p.name}</span></div>`;
      pin.onclick=(e)=>{e.stopPropagation();select.current(p.id);};
      labelsContainer.appendChild(pin);
      currentPins.push({element:pin,partIndex:idx});
     });
    }else if(lastIsolate){camera.clearViewOffset();fit(s.view,amount);labelsContainer.innerHTML='';currentPins=[];}
    lastIsolate=isolateKey;
   }
   if(s.sliceActive){
    const axis=s.sliceAxis||'coronal',val=typeof s.sliceValue==='number'?s.sliceValue:0.5;
    const box=new T.Box3();
    atlas.parts.forEach((p,i)=>{if(data[i*4+3]>.5){box.union(bounds[i].clone().translate(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])));}});
    if(!box.isEmpty()){
     let nx=0,ny=0,nz=-1,targetConstant=10000;
     if(axis==='coronal'){nx=0;ny=0;nz=-1;targetConstant=T.MathUtils.lerp(box.min.z,box.max.z,1-val);}
     else if(axis==='axial'){nx=0;ny=-1;nz=0;targetConstant=T.MathUtils.lerp(box.min.y,box.max.y,1-val);}
     else if(axis==='sagittal'){nx=-1;ny=0;nz=0;targetConstant=T.MathUtils.lerp(box.min.x,box.max.x,1-val);}
     if(clipPlane.normal.x!==nx||clipPlane.normal.y!==ny||clipPlane.normal.z!==nz||Math.abs(clipPlane.constant-targetConstant)>1e-4){
      clipPlane.normal.set(nx,ny,nz);
      clipPlane.constant=targetConstant;
      dirty=true;
     }
    }
   }else if(clipPlane.constant<5000){clipPlane.normal.set(0,0,-1);clipPlane.constant=10000;dirty=true;}
   controls.enableRotate=amount<.8;controls.mouseButtons.LEFT=amount<.8?T.MOUSE.ROTATE:T.MOUSE.PAN;controls.touches.ONE=amount<.8?T.TOUCH.ROTATE:T.TOUCH.PAN;ground.visible=platform.visible=ring.visible=innerRing.visible=amount<.5&&!s.isolate;markers.visible=amount>.75;controls.autoRotate=s.rotate&&amount<.4;controls.autoRotateSpeed=.65;controls.update();if(controls.autoRotate)dirty=true;
   if(s.isolate&&s.labelsVisible!==false&&s.mode!=='quiz'&&currentPins.length>0){
    labelsContainer.style.display='block';
    currentPins.forEach(pin=>{
     const idx=pin.partIndex;
     projected.copy(centers[idx]).add(new T.Vector3(data[idx*4],data[idx*4+1],data[idx*4+2])).project(camera);
     if(projected.z>=-1&&projected.z<=1){
      const px=(projected.x+1)*el.clientWidth/2,py=(1-projected.y)*el.clientHeight/2;
      pin.element.style.transform=`translate(${Math.round(px)}px,${Math.round(py)}px)`;
      pin.element.style.display='flex';
     }else{pin.element.style.display='none';}
    });
   }else{labelsContainer.style.display='none';}
   if(dirty){
    renderer.render(scene,camera);targets=[];
    if(amount>.45||s.isolate){
     const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);
     atlas.parts.forEach((p,i)=>{
      if(data[i*4+3]<.5||(hasSolid&&p.system==='integumentary'))return;
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(let corner=0;corner<8;corner++){projected.set(p.bounds[(corner&1)?1:0][0]+data[i*4],p.bounds[(corner&2)?1:0][1]+data[i*4+1],p.bounds[(corner&4)?1:0][2]+data[i*4+2]).project(camera);const x=(projected.x+1)*el.clientWidth/2,y=(1-projected.y)*el.clientHeight/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      projected.copy(centers[i]).add(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])).project(camera);
      if(projected.z< -1||projected.z>1)return;
      targets.push({index:i,x:(projected.x+1)*el.clientWidth/2,y:(1-projected.y)*el.clientHeight/2,left,right,top,bottom});
     });
    }
    dirty=false;
   }
  };animate();
  const contextLost=(e:Event)=>{e.preventDefault();onError('The 3D session was paused by your device. Reload to continue.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();selectionTexture.dispose();markerGeometry.dispose();markerMaterial.dispose();hover.remove();labelsContainer.remove();renderer.dispose();renderer.domElement.removeEventListener('dblclick',dblClick);renderer.domElement.remove();};
 },[atlas]);
 return <div className="scene" ref={host}/>;
}
