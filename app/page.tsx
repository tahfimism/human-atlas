import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Activity,AlertCircle,ArrowUpRight,CheckCircle2,ChevronRight,Focus,HelpCircle,Info,Layers3,Pause,RotateCcw,RotateCw,Scissors,Search,Tag,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import AnatomyScene from './scene';
import {DEFAULT_VISIBLE,SYSTEMS,EXPLANATIONS,explanation,getLatinName,type Atlas,type Concept,type SceneState,type SliceAxis,type SystemId,type View} from './anatomy';

const initial:SceneState={explode:0,visible:DEFAULT_VISIBLE,selected:[],isolatedParts:undefined,labelsVisible:true,isolate:false,view:'front',rotate:false,reset:0,sliceActive:false,sliceAxis:'coronal',sliceValue:0.5,mode:'normal',quizTarget:''};
let cachedAtlasData: Atlas | null = null;
const ORGAN_CHUNKS: Record<string, number[]> = {
 heart: [8, 9], brain: [5, 6, 7], liver: [7, 8, 11], stomach: [9],
 spleen: [9], pancreas: [7, 9], 'urinary bladder': [11], trachea: [9],
 lungs: [8, 9], kidney: [11], femur: [12, 13],
 skull: [0, 10, 12, 13], spine: [11, 12, 13], 'vertebral column': [11, 12, 13],
 ribs: [12, 13], rib: [12, 13], pelvis: [11, 12], 'hip bone': [11, 12]
};

export default function Home(){
 const detailTitle=useRef<HTMLHeadingElement>(null);
 const urlParams=typeof window!=='undefined'?new URLSearchParams(window.location.search):null;
 const organParam=urlParams?.get('organ')||urlParams?.get('concept');
 const isEmbed=urlParams?.get('embed')==='true'||!!organParam;
 const isMini=urlParams?.get('mini')==='true'||urlParams?.get('ui')==='false';
 const isolateParam=urlParams?.get('isolate')!=='false';
 const viewParam=(urlParams?.get('view') as View)||'front';
 const rotateParam=urlParams?.get('rotate')==='true';

 const sliceParam=urlParams?.get('slice');
 const sliceActiveInit=sliceParam==='coronal'||sliceParam==='axial'||sliceParam==='sagittal'||sliceParam==='true';
 const sliceAxisInit:SliceAxis=(sliceParam==='axial'||sliceParam==='sagittal')?sliceParam:'coronal';
 const sliceOffsetRaw=urlParams?.get('sliceOffset');
 const sliceValueInit=sliceOffsetRaw!==null&&sliceOffsetRaw!==undefined&&!isNaN(Number(sliceOffsetRaw))
   ?Math.max(0,Math.min(1,Number(sliceOffsetRaw)))
   :0.5;

 const modeParam=urlParams?.get('mode');
 const modeInit:'quiz'|'normal'=modeParam==='quiz'?'quiz':'normal';
 const quizTargetParam=urlParams?.get('quizTarget')||'';

 let initialChosen: Concept | null = null;
 let initialIsoParts: string[] | undefined = undefined;
 if(cachedAtlasData && organParam){
  const q=organParam.toLowerCase().trim();
  const match=cachedAtlasData.concepts.find(c=>c.name.toLowerCase()===q||c.id.toLowerCase()===q);
  if(match){
   initialChosen=match;
   initialIsoParts=match.elements;
  }
 }
 const [atlas,setAtlas]=useState<Atlas|null>(cachedAtlasData);
 const [chosen,setChosen]=useState<Concept|null>(initialChosen);
 const [state,setState]=useState<SceneState>({
  ...initial,
  isolatedParts:initialIsoParts,
  isolate:isolateParam,
  view:viewParam,
  rotate:rotateParam,
  labelsVisible:!isMini && modeInit!=='quiz',
  sliceActive:sliceActiveInit,
  sliceAxis:sliceAxisInit,
  sliceValue:sliceValueInit,
  mode:modeInit,
  quizTarget:quizTargetParam
 });
 const [quizFeedback,setQuizFeedback]=useState<{type:'correct'|'incorrect';message:string}|null>(null);
 const [progress,setProgress]=useState(0),[error,setError]=useState(''),[panel,setPanel]=useState<'layers'|'search'|null>(null),[details,setDetails]=useState(false),[about,setAbout]=useState(false),[query,setQuery]=useState('');

 useEffect(()=>{
  if(!quizFeedback)return;
  const t=setTimeout(()=>setQuizFeedback(null),4500);
  return()=>clearTimeout(t);
 },[quizFeedback]);

 useEffect(()=>{
  const abort=new AbortController();setProgress(0);setError('');setDetails(false);
  if(organParam){
   const preChunks=ORGAN_CHUNKS[organParam.toLowerCase().trim()];
   if(preChunks){
    preChunks.forEach(ci=>{
     fetch(`/models/body-${ci}.chunk`,{priority:'high'}).catch(()=>{});
    });
   }
  }
  const applyAtlas=(data:Atlas)=>{
   cachedAtlasData=data;
   setAtlas(data);
   if(organParam){
    const q=organParam.toLowerCase().trim();
    const match=data.concepts.find(c=>c.name.toLowerCase()===q||c.id.toLowerCase()===q);
    if(match){
     setChosen(match);
     setState(s=>({...s,selected:[],isolatedParts:match.elements,labelsVisible:s.mode!=='quiz',isolate:isolateParam,view:viewParam,rotate:rotateParam,reset:s.reset+1}));
    }
   }
  };
  if(cachedAtlasData){
   applyAtlas(cachedAtlasData);
  }else{
   fetch('/models/atlas.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('The anatomy catalogue could not be loaded.');return r.json();}).then((data:any)=>{
    applyAtlas(data as Atlas);
   }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  }
  return()=>abort.abort();
 },[]);

 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='/'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();setPanel('search');setDetails(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const parts=useMemo(()=>new Map(atlas?.parts.map(p=>[p.id,p])),[atlas]);
 const priorityChunks=useMemo(()=>{
  if(!atlas||!parts.size)return undefined;
  const targetElements=chosen?.elements||state.isolatedParts;
  if(!targetElements||!targetElements.length)return undefined;
  const chunkList=targetElements.map(id=>parts.get(id)?.chunk).filter((c):c is number=>c!==undefined);
  return chunkList.length>0?[...new Set(chunkList)]:undefined;
 },[chosen,state.isolatedParts,atlas,parts]);
 const counts=useMemo(()=>Object.fromEntries(SYSTEMS.map(s=>[s.id,atlas?.parts.filter(p=>p.system===s.id).length??0])),[atlas]);
 const activeSystems=SYSTEMS.filter(s=>counts[s.id]>0);
 const selectedParts=state.selected.map(id=>parts.get(id)).filter((p):p is NonNullable<typeof p>=>!!p),selected=selectedParts[0],system=SYSTEMS.find(s=>s.id===selected?.system);
 const isolateIds=state.isolatedParts&&state.isolatedParts.length>0?state.isolatedParts:state.selected;
 const visibleCount=atlas?.parts.filter(p=>state.isolate?isolateIds.includes(p.id):state.visible.includes(p.system)||state.selected.includes(p.id)).length??0;
 const results=useMemo(()=>{if(!atlas)return[];const term=query.toLowerCase().trim();if(!term)return ['heart','brain','liver','stomach','spleen','pancreas','urinary bladder','trachea'].map(name=>atlas.concepts.find(c=>c.name.toLowerCase()===name)).filter((x):x is Concept=>!!x);return atlas.concepts.filter(c=>c.name.toLowerCase().includes(term)||c.id.toLowerCase().includes(term)).sort((a,b)=>a.name.length-b.name.length).slice(0,80);},[atlas,query]);

 const choose=(c:Concept)=>{
  setChosen(c);setState(s=>({...s,selected:c.elements,isolatedParts:c.elements,isolate:false,rotate:false}));setDetails(true);setPanel(null);
  if(typeof window!=='undefined'&&window.parent&&window.parent!==window){window.parent.postMessage({type:'EVT_READY',payload:{organ:c.name,partsCount:c.elements.length,id:c.id}},'*');}
 };
 useEffect(()=>{if(!atlas)return;return registerAtlasTools(atlas,c=>flushSync(()=>choose(c)));},[atlas]);

 const choosePart=(id:string)=>{
  const p=parts.get(id);if(!p)return;

  if(state.mode==='quiz'){
   const q=(state.quizTarget||'').toLowerCase().trim();
   const pName=p.name.toLowerCase().trim();
   const concept=atlas?.concepts.find(c=>c.id===p.conceptId||c.elements.includes(p.id));
   const cName=(concept?.name||'').toLowerCase().trim();
   const latinP=(getLatinName(p.name)||'').toLowerCase().trim();
   const latinC=(getLatinName(concept?.name)||'').toLowerCase().trim();

   let isCorrect=false;
   if(q.length>0){
    isCorrect=(
     pName===q ||
     pName.includes(q) ||
     q.includes(pName) ||
     cName===q ||
     cName.includes(q) ||
     q.includes(cName) ||
     (latinP!=='' && (latinP===q || latinP.includes(q) || q.includes(latinP))) ||
     (latinC!=='' && (latinC===q || latinC.includes(q) || q.includes(latinC)))
    );
   }

   if(typeof window!=='undefined'&&window.parent){
    window.parent.postMessage({
     type:'EVT_QUIZ_ANSWER',
     payload:{
      clickedId:p.id,
      name:p.name,
      quizTarget:state.quizTarget||'',
      isCorrect
     }
    },'*');
   }

   if(isCorrect){
    setQuizFeedback({
     type:'correct',
     message:`Correct! You found the ${p.name}`
    });
    setState(s=>({...s,selected:[p.id]}));
   }else{
    setQuizFeedback({
     type:'incorrect',
     message:`Not quite! That's the ${p.name}. Try again!`
    });
   }
   return;
  }

  setChosen({id:p.conceptId,name:p.name,elements:[id]});setState(s=>({...s,selected:[id],isolate:s.isolate,rotate:false}));setDetails(true);setPanel(null);
  if(typeof window!=='undefined'&&window.parent&&window.parent!==window){window.parent.postMessage({type:'EVT_PART_CLICKED',payload:{partId:p.id,name:p.name,conceptId:p.conceptId,system:p.system}},'*');}
 };

 const isolatePart=(id:string|null)=>{
  if(id){
   const p=parts.get(id);if(!p)return;
   setState(s=>({...s,selected:[id],isolatedParts:[id],isolate:true,reset:s.reset+1}));
   setDetails(true);setPanel(null);
   if(typeof window!=='undefined'&&window.parent&&window.parent!==window){
    window.parent.postMessage({type:'EVT_PART_ISOLATED',payload:{partId:p.id,name:p.name,conceptId:p.conceptId,system:p.system,organ:chosen?.name}},'*');
   }
  }else{
   if(chosen){
    setState(s=>({...s,selected:[],isolatedParts:chosen.elements,isolate:true,reset:s.reset+1}));
   }else{
    setState(s=>({...s,selected:[],isolatedParts:undefined,isolate:false,reset:s.reset+1}));
   }
   setDetails(false);
   if(typeof window!=='undefined'&&window.parent&&window.parent!==window){
    window.parent.postMessage({type:'EVT_ISOLATE_CLEARED',payload:{organ:chosen?.name}},'*');
   }
  }
 };

 useEffect(()=>{
  if(atlas&&chosen&&typeof window!=='undefined'&&window.parent&&window.parent!==window){
   window.parent.postMessage({type:'EVT_READY',payload:{organ:chosen.name,partsCount:chosen.elements.length,id:chosen.id}},'*');
  }
 },[atlas,chosen]);

 useEffect(()=>{
  if(typeof window==='undefined')return;
  const onMessage=(e:MessageEvent)=>{
   if(!e.data||typeof e.data!=='object'||!atlas)return;
   const {type,payload}=e.data;
   if(type==='CMD_FOCUS_ORGAN'&&payload?.organ){
    const q=String(payload.organ).toLowerCase().trim();
    const match=atlas.concepts.find(c=>c.name.toLowerCase()===q||c.id.toLowerCase()===q);
    if(match){setChosen(match);setState(s=>({...s,selected:payload.subpart?[payload.subpart]:[],isolatedParts:match.elements,labelsVisible:s.mode!=='quiz',isolate:payload.isolate!==false,rotate:false,reset:s.reset+1}));}
   }else if(type==='CMD_SET_VIEW'&&payload?.view){
    setState(s=>({...s,view:payload.view,reset:s.reset+1}));
   }else if(type==='CMD_TOGGLE_ISOLATE'){
    if(!organParam){setState(s=>({...s,isolate:payload.isolate??!s.isolate,selected:s.isolate?s.selected:[],reset:s.reset+1}));}
   }else if(type==='CMD_SET_SLICE'){
    const axis=(payload?.axis==='coronal'||payload?.axis==='axial'||payload?.axis==='sagittal')?payload.axis:undefined;
    const val=typeof payload?.value==='number'?payload.value:(typeof payload?.sliceOffset==='number'?payload.sliceOffset:(typeof payload?.offset==='number'?payload.offset:undefined));
    setState(s=>({
     ...s,
     sliceActive:payload?.active!==false,
     sliceAxis:axis||s.sliceAxis,
     sliceValue:typeof val==='number'?Math.max(0,Math.min(1,val)):s.sliceValue
    }));
   }else if(type==='CMD_CLEAR_SLICE'){
    setState(s=>({...s,sliceActive:false}));
   }else if(type==='CMD_QUIZ_FEEDBACK'){
    const isCorrect=payload?.correct??payload?.isCorrect??(payload?.result==='correct');
    const msg=payload?.message||(isCorrect?'Correct!':'Not quite! Try again!');
    setQuizFeedback({
     type:isCorrect?'correct':'incorrect',
     message:msg
    });
    if(isCorrect&&payload?.partId){
     setState(s=>({...s,selected:[payload.partId]}));
    }
   }else if(type==='CMD_SET_QUIZ'||type==='CMD_START_QUIZ'){
    setState(s=>({
     ...s,
     mode:'quiz',
     quizTarget:payload?.target||payload?.quizTarget||s.quizTarget||''
    }));
   }else if(type==='CMD_ISOLATE_PART'&&payload?.partId){
     isolatePart(payload.partId);
    }else if(type==='CMD_RESTORE_ORGAN'){
     isolatePart(null);
    }else if(type==='CMD_RESET'){
    reset();
   }
  };
  if(progress===100&&urlParams?.get('snapshot')==='true'){
   const timer=setTimeout(()=>{
    const canvas=document.querySelector('canvas');
    if(canvas&&window.parent&&window.parent!==window){
     const dataUrl=canvas.toDataURL('image/webp',0.92);
     window.parent.postMessage({type:'EVT_SNAPSHOT_READY',organ:chosen?.name||organParam||'organ',dataUrl},'*');
    }
   },450);
   return ()=>clearTimeout(timer);
  }
  window.addEventListener('message',onMessage);
  return()=>window.removeEventListener('message',onMessage);
 },[atlas,parts,chosen]);

 const toggle=(id:SystemId)=>{setDetails(false);setState(s=>({...s,selected:[],isolatedParts:undefined,isolate:false,visible:s.visible.includes(id)?s.visible.filter(x=>x!==id):[...s.visible,id]}));};
 const reset=()=>{if(organParam&&chosen){setState(s=>({...s,selected:[],isolatedParts:chosen.elements,labelsVisible:s.mode!=='quiz',isolate:true,view:'front',explode:0,reset:s.reset+1}));}else{setState(s=>({...initial,visible:DEFAULT_VISIBLE,isolatedParts:undefined,labelsVisible:s.mode!=='quiz',view:'front',reset:s.reset+1}));setChosen(null);}setDetails(false);setPanel(null);};
 const openPanel=(next:'layers'|'search')=>{setDetails(false);setPanel(p=>p===next?null:next);};

 const latinName = chosen ? getLatinName(chosen.name) : (selected ? getLatinName(selected.name) : undefined);

 return <main className={`studio ${isEmbed?'is-embed':''} ${isMini?'is-mini':''}`}>
  {atlas&&<AnatomyScene atlas={atlas} state={{...state,labelsVisible:isMini||state.mode==='quiz'?false:state.labelsVisible,inspectorOpen:details&&selectedParts.length>0}} priorityChunks={priorityChunks} onSelect={choosePart} onIsolatePart={isolatePart} onProgress={n=>{setProgress(n);if(n===100)setError('');}} onError={setError}/>}
  <div className="vignette"/>
  {!isMini&&isEmbed&&chosen&&(
   <div className="embed-pill glass">
    <div className="embed-organ-meta">
     <span className="system-dot" style={{background:system?.color||'#3b82f6'}}/>
     <span>{chosen.name}</span>
     {state.isolatedParts?.length===1&&chosen.elements.length>1?(
      <>
       <span style={{color:'#94a3b8',margin:'0 2px'}}>›</span>
       <span style={{fontWeight:600,color:'#0f172a'}}>{parts.get(state.isolatedParts[0])?.name||'Subpart'}</span>
       <button className="subpart-restore-btn" onClick={()=>isolatePart(null)} title={`Restore full ${chosen.name} view`}>
        ↩ Whole {chosen.name}
       </button>
      </>
     ):(
      <>
       {getLatinName(chosen.name)&&(
        <Badge variant="outline" className="latin-badge" title="Terminologia Anatomica">
         TA: {getLatinName(chosen.name)}
        </Badge>
       )}
       <span className="small-number">{chosen.elements.length} {chosen.elements.length===1?'piece':'pieces'}</span>
      </>
     )}
    </div>
    <div className="embed-actions">
     <button className={state.sliceActive?'active':''} onClick={()=>setState(s=>({...s,sliceActive:!s.sliceActive}))} title="Toggle cross-section slicer">
      <Scissors size={13}/><span>Slice</span>
     </button>
     <button className={state.labelsVisible!==false?'active':''} onClick={()=>setState(s=>({...s,labelsVisible:s.labelsVisible===false}))} title="Toggle anatomical landmark labels">
      <Tag size={13}/><span>Labels</span>
     </button>
     <button onClick={reset} title="Reset to front view"><RotateCcw size={13}/><span>Front</span></button>
    </div>
   </div>
  )}
  {!isMini&&state.sliceActive&&(
   <div className="slicer-pill glass" role="region" aria-label="Cross-section slicer controls">
    <span style={{fontWeight:600,display:'flex',alignItems:'center',gap:5,color:'#0f172a'}}>
     <Scissors size={12}/> Cross-Section:
    </span>
    <div className="slicer-axes">
     <button className={state.sliceAxis==='coronal'||!state.sliceAxis?'active':''} onClick={()=>setState(s=>({...s,sliceAxis:'coronal'}))}>Coronal</button>
     <button className={state.sliceAxis==='axial'?'active':''} onClick={()=>setState(s=>({...s,sliceAxis:'axial'}))}>Axial</button>
     <button className={state.sliceAxis==='sagittal'?'active':''} onClick={()=>setState(s=>({...s,sliceAxis:'sagittal'}))}>Sagittal</button>
    </div>
    <div className="slicer-slider-wrap">
     <input
      type="range"
      min="0"
      max="100"
      value={Math.round((state.sliceValue??0.5)*100)}
      onChange={e=>setState(s=>({...s,sliceValue:Number(e.target.value)/100}))}
      aria-label="Cross-section cut depth"
     />
    </div>
    <span className="slicer-pct">{Math.round((state.sliceValue??0.5)*100)}%</span>
    <button onClick={()=>setState(s=>({...s,sliceActive:false}))} style={{border:0,background:'none',color:'#94a3b8',cursor:'pointer',padding:2,display:'flex',alignItems:'center'}} title="Close slicer"><X size={14}/></button>
   </div>
  )}
  {!isMini&&state.mode==='quiz'&&(
   <div className="quiz-hud glass" role="status" aria-live="polite">
    <div className="quiz-hud-content">
     <span className="quiz-hud-badge">Quiz Mode</span>
     <span className="quiz-hud-instruction">
      Locate and click on the <strong>{state.quizTarget || 'target structure'}</strong>
     </span>
    </div>
    <button
     className="quiz-hud-close"
     onClick={()=>setState(s=>({...s,mode:'normal'}))}
     title="Exit Quiz Mode"
     aria-label="Exit Quiz Mode"
    >
     <X size={14}/>
    </button>
   </div>
  )}
  {quizFeedback&&(
   <div className={`quiz-feedback-toast glass ${quizFeedback.type}`} role="alert" aria-live="assertive">
    {quizFeedback.type==='correct'?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>}
    <span className="quiz-feedback-message">{quizFeedback.message}</span>
    <button onClick={()=>setQuizFeedback(null)} className="quiz-feedback-close" title="Dismiss feedback">
     <X size={13}/>
    </button>
   </div>
  )}
  {!isMini&&<header className="identity"><div className="eyebrow"><span className="status-dot"/> INTERACTIVE ANATOMY</div><h1>Human Atlas<Badge variant="outline" className="edition">3D</Badge></h1><div className="identity-meta">{atlas?atlas.parts.length.toLocaleString():'2,234'} modeled pieces <span>·</span> BodyParts3D</div></header>}
  {!isMini&&<nav className="top-actions" aria-label="Explorer panels"><Button variant="ghost" className={panel==='search'?'active':''} onClick={()=>openPanel('search')} aria-label="Search anatomy"><Search size={18}/><span>Find a structure</span><kbd>/</kbd></Button><Button variant="ghost" className="icon-button" aria-label="About this atlas" onClick={()=>{setDetails(false);setPanel(null);setAbout(true);}}><Info size={18}/></Button></nav>}
  {!isMini&&<section className={`layers-panel glass ${panel==='layers'?'mobile-open':''}`} aria-label="Anatomical layers">
   <div className="panel-heading"><span>Systems</span><Button variant="ghost" className="mobile-only icon-button" onClick={()=>setPanel(null)} aria-label="Close systems"><X size={18}/></Button><Badge variant="secondary" className="desktop-only small-number">{activeSystems.length}</Badge></div>
   <div className="layer-presets"><Button variant="ghost" aria-pressed={activeSystems.every(x=>state.visible.includes(x.id))} onClick={()=>setState(s=>({...s,selected:[],isolate:false,visible:activeSystems.map(x=>x.id)}))}>All</Button><Button variant="ghost" aria-pressed={state.visible.length===1&&state.visible[0]==='skeletal'} onClick={()=>setState(s=>({...s,selected:[],isolate:false,visible:['skeletal']}))}>Skeleton</Button><Button variant="ghost" aria-pressed={state.visible.length===6&&['cardiac','respiratory','digestive','urinary','endocrine','reproductive'].every(id=>state.visible.includes(id as SystemId))} onClick={()=>setState(s=>({...s,selected:[],isolate:false,visible:['cardiac','respiratory','digestive','urinary','endocrine','reproductive']}))}>Organs</Button></div>
   <div className="system-list">{activeSystems.map(s=><div className={`system-row ${state.visible.includes(s.id)?'enabled':''}`} key={s.id}><Button variant="ghost" className="system-name" title={`Show only ${s.name.toLowerCase()}`} onClick={()=>setState(v=>({...v,visible:[s.id],isolate:false,selected:[]}))}><span className="system-dot" style={{background:s.color}}/>{s.name}<span className="system-count">{counts[s.id]}</span></Button><Switch checked={state.visible.includes(s.id)} onCheckedChange={()=>toggle(s.id)} aria-label={`Show ${s.name.toLowerCase()}`} /></div>)}</div>
   <div className="panel-foot"><span>{visibleCount.toLocaleString()} pieces visible</span><Button variant="ghost" onClick={()=>setState(s=>({...s,visible:[],selected:[],isolate:false}))}>Hide all</Button></div>
  </section>}
  {!isMini&&panel==='search'&&<section className="search-panel glass" aria-label="Find anatomy"><div className="panel-heading"><span>Find a structure</span><Button variant="ghost" className="icon-button" onClick={()=>setPanel(null)} aria-label="Close search"><X size={18}/></Button></div><Combobox<Concept> items={results} value={null} onValueChange={(value:Concept|null)=>{if(value)choose(value);}} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={(c:Concept)=>c.name} filter={null} open onOpenChange={(open:boolean)=>{if(!open)setPanel(null);}}><ComboboxInput autoFocus placeholder="Heart, femur, cranial nerve…" aria-label="Search named anatomical structures" showTrigger={false}/><ComboboxContent className="anatomy-search-results"><ComboboxEmpty>No structures match your search.</ComboboxEmpty><ComboboxList>{(c:Concept)=><ComboboxItem key={c.id} value={c}><span className="search-result-name">{c.name}</span><span className="small-number">{c.elements.length} {c.elements.length===1?'piece':'pieces'}</span></ComboboxItem>}</ComboboxList></ComboboxContent></Combobox><p className="search-note">{query?'Showing up to 80 matches. Refine your search to find smaller structures.':'Start with a major organ, or search every named structure.'}</p></section>}
  {!isMini&&<nav className="view-controls glass" aria-label="Camera controls">{(['front','side','back'] as View[]).map((v,i)=><Button variant="ghost" key={v} className={state.view===v?'active':''} aria-pressed={state.view===v} disabled={state.explode>.8&&v!=='front'} onClick={()=>setState(s=>({...s,view:v,reset:s.reset+1,rotate:false}))} title={`${v} view`} aria-label={`${v} view`}><span>{['F','S','B'][i]}</span></Button>)}<i/><Button variant="ghost" className={state.sliceActive?'active':''} onClick={()=>setState(s=>({...s,sliceActive:!s.sliceActive}))} title="Toggle cross-section slicer" aria-label="Toggle cross-section slicer"><Scissors size={17}/></Button><Button variant="ghost" disabled={state.explode>=.4} aria-label={state.rotate?'Pause rotation':'Rotate body'} title="Auto rotate" className={state.rotate?'active':''} onClick={()=>setState(s=>({...s,rotate:!s.rotate}))}>{state.rotate?<Pause size={17}/>:<RotateCw size={18}/>}</Button><Button variant="ghost" aria-label="Reset view and layers" title="Reset" onClick={reset}><RotateCcw size={17}/></Button></nav>}
  {!isMini&&<div className="scene-caption"><span className="caption-line"/><span>{state.isolate?(chosen?.name??'SELECTED STRUCTURE'):state.explode>.95?'ANATOMICAL INVENTORY':state.explode>.05?'SEPARATED STRUCTURES':'ADULT HUMAN · MALE'}</span><span className="caption-line"/></div>}
  {!isMini&&<div className="bottom-dock glass"><Button variant="ghost" className="mobile-only dock-layers" onClick={()=>openPanel('layers')} aria-label="Open system layers"><Layers3 size={20}/><span>Systems</span></Button><div className="explode-control"><div className="explode-label"><label id="explode-label">Explode anatomy</label><output>{Math.round(state.explode*100)}<span>%</span></output></div><Slider aria-labelledby="explode-label" min={0} max={100} step={1} value={[state.explode*100]} onValueChange={(v:number|number[])=>setState(s=>({...s,explode:(Array.isArray(v)?v[0]:v)/100,view:(Array.isArray(v)?v[0]:v)>80?'front':s.view,rotate:false}))}/><div className="slider-endpoints"><span>Assembled</span><span>Every piece</span></div></div><Button variant="ghost" className="dock-reset" onClick={reset} aria-label="Assemble and reset"><RotateCcw size={18}/><span>Reset</span></Button></div>}
  {!isMini&&<footer className="studio-footer"><span>{state.explode>.8?'Drag to pan':'Drag to orbit'} <b>·</b> Pinch to zoom <b>·</b> Tap to inspect</span><Button variant="ghost" onClick={()=>{setDetails(false);setPanel(null);setAbout(true);}}>Source & credits <ArrowUpRight size={12}/></Button></footer>}
  {progress<100&&!error&&<div className="loading glass" role="status"><Activity size={18}/><div><strong>Preparing the anatomy</strong><span>{progress}% · Loading {state.isolate&&chosen ? `${chosen.elements.length} ${chosen.name} pieces` : `${atlas?.parts.length.toLocaleString()??'2,234'} pieces`}</span><div className="loading-track"><i style={{width:`${progress}%`}}/></div></div></div>}
  {error&&<div className="loading glass error" role="alert"><p>{error}</p><Button variant="ghost" onClick={()=>location.reload()}>Reload viewer</Button></div>}
  <Sheet open={details&&selectedParts.length>0} modal={false} disablePointerDismissal onOpenChange={setDetails}><SheetContent initialFocus={detailTitle} className={`detail-sheet glass ${state.isolate?'is-isolated':''}`} showCloseButton={true}><div className="detail-header"><div className="detail-accent" style={{background:system?.color}}/><div className="eyebrow">{system?.name??'ANATOMY'}</div><SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">{chosen?.name}</SheetTitle>{latinName&&<div className="latin-badge-row"><Badge variant="secondary" className="latin-badge" title="Terminologia Anatomica">TA: {latinName}</Badge></div>}</div><div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}><SheetDescription className="structure-description">{chosen&&selected?explanation(chosen.name,selected.system):''}</SheetDescription>{chosen&&!EXPLANATIONS[chosen.name.toLowerCase()]&&<span className="context-note">System overview · structure identified from source anatomy</span>}<div className="structure-meta"><span>Atlas reference<strong>{chosen?.id}</strong></span><span>Selected pieces<strong>{state.selected.length.toLocaleString()}</strong></span></div>{selectedParts.length>1&&<div className="member-list"><h3>Included structures</h3>{selectedParts.slice(0,50).map(p=><Button variant="ghost" key={p.id} onClick={()=>choosePart(p.id)}><span>{p.name}</span><ChevronRight size={14}/></Button>)}{selectedParts.length>50&&<p>And {selectedParts.length-50} more modeled pieces.</p>}</div>}<a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">View anatomical source <ArrowUpRight size={14}/></a></div><div className="detail-actions">
 {selectedParts.length===1&&state.isolatedParts?.length!==1&&(
  <Button variant="default" className="primary-action" onClick={()=>isolatePart(selectedParts[0].id)}>
   <Focus size={14}/> Isolate this part
  </Button>
 )}
 {state.isolatedParts?.length===1&&(
  <Button variant="default" className="primary-action" onClick={()=>isolatePart(null)}>
   <RotateCcw size={14}/> Whole {chosen?.name||'organ'}
  </Button>
 )}
 <Button variant="ghost" className="secondary-action" onClick={()=>{setState(s=>({...s,selected:[],isolate:organParam?true:false}));setDetails(false);}}>Clear selection</Button>
</div></SheetContent></Sheet>
  <Sheet open={about} onOpenChange={setAbout}><SheetContent className="about-sheet glass"><div className="eyebrow">SOURCE & SCOPE</div><SheetTitle className="structure-title">A body, revealed.</SheetTitle><SheetDescription>Explore the adult male reference anatomy from BodyParts3D.</SheetDescription><div className="about-copy"><p><strong>Male · BodyParts3D</strong><br/>2,234 individual meshes and 3,432 named concepts from an adult male reference anatomy.</p><p>This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.</p><p>Colors and system groupings are designed for exploration. The geometry is simplified for the web, and short explanations provide general educational context. This is an anatomical reference, not a diagnostic or surgical tool.</p><h3>Source</h3><p>BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.</p><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Dataset license <ArrowUpRight size={14}/></a><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">Original geometry & metadata <ArrowUpRight size={14}/></a><a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">Read the source publication <ArrowUpRight size={14}/></a></div></SheetContent></Sheet>
 </main>;
}
