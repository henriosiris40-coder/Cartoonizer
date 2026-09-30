/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
let toastTimeout=null;
function showToast(msg,type='success',duration=2500){const t=document.getElementById('toast'),x=document.getElementById('toast-text');t.classList.remove('visible','success','error','warn');void t.offsetWidth;x.textContent=msg;t.classList.add(type,'visible');if(toastTimeout)clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('visible'),duration);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let modalResolver=null;
function showModal({icon='⚠️',title,message,confirmText='Confirmer',cancelText='Annuler',variant='confirm'}){
return new Promise(resolve=>{
modalResolver=resolve;
document.getElementById('modal-icon').textContent=icon;
document.getElementById('modal-title').textContent=title;
document.getElementById('modal-message').innerHTML=message;
document.getElementById('modal-confirm').textContent=confirmText;
document.getElementById('modal-cancel').textContent=cancelText;
const cb=document.getElementById('modal-confirm');
cb.style.background=variant==='danger'?'linear-gradient(135deg,#dc2626,#991b1b)':'linear-gradient(135deg,#10b981,#059669)';
document.getElementById('modal-overlay').classList.add('visible');
});
}
document.getElementById('modal-cancel').onclick=()=>{document.getElementById('modal-overlay').classList.remove('visible');if(modalResolver){modalResolver(false);modalResolver=null;}};
document.getElementById('modal-confirm').onclick=()=>{document.getElementById('modal-overlay').classList.remove('visible');if(modalResolver){modalResolver(true);modalResolver=null;}};

/* ═══════════════════════════════════════════════════════════════
   PERSISTANCE
   ═══════════════════════════════════════════════════════════════ */
const LS_CHARS='agnes_v5_chars';
const LS_SCENES='agnes_v5_scenes';
function saveChars(){try{const d=state.characters.map(c=>({id:c.id,name:c.name,source:c.source,description:c.description,appearance:c.appearance,personality:c.personality,validated:c.validated,validatedImage:c.validatedImage,generatedImage:c.generatedImage,thumbnail:c.thumbnail,wardrobe:c.wardrobe,wardrobeValidated:c.wardrobeValidated,validatedWardrobe:c.validatedWardrobe,savedOutfits:c.savedOutfits,createdAt:c.createdAt}));localStorage.setItem(LS_CHARS,JSON.stringify(d));}catch(e){showToast('Stockage saturé','warn',4000);}}
function loadChars(){try{const raw=localStorage.getItem(LS_CHARS);if(!raw)return[];return JSON.parse(raw).map(c=>({...c,photoDataUri:null,savedOutfits:c.savedOutfits||[],activeStudioTab:c.activeStudioTab||'identity',activeWardrobeTab:c.activeWardrobeTab||'top'}));}catch(e){return[];}}
function saveScenes(){try{localStorage.setItem(LS_SCENES,JSON.stringify(state.scenes));}catch(e){}}
function loadScenes(){try{return JSON.parse(localStorage.getItem(LS_SCENES)||'[]').map(s=>({...s,drafts:s.drafts||[]}));}catch(e){return[];}}

const state={
videoLoaded:false,videoDuration:0,videoWidth:0,videoHeight:0,videoUrl:'',
isRunning:false,stopRequested:false,mode:'canvas',
detectedScenes:[],bgmFile:null,recorder:null,outputBlob:null,outputUrl:null,
audioCtx:null,ffmpeg:null,ffmpegLoaded:false,currentHashtags:[],
characters:loadChars(),scenes:loadScenes(),
openCharacterId:null,studioStyle:'cartoon',openSceneImagePanel:null,
threeInstances:{},
recordingAudioFile:null,
vrMode:'native',vrSession:null,vrActive:false,
multiScene:null,
envPreset:'dark',
fileSystemHandle:null
};

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const STUDIO_STYLES=[{id:'cartoon',name:'Cartoon',emoji:'🎨'},{id:'anime',name:'Anime',emoji:'🌸'},{id:'manga',name:'Manga',emoji:'🖤'},{id:'comic',name:'Comic US',emoji:'💥'},{id:'ghibli',name:'Ghibli',emoji:'🌿'},{id:'simpson',name:'Simpson',emoji:'🍩'},{id:'watercolor',name:'Aquarelle',emoji:'💧'},{id:'sketch',name:'Croquis',emoji:'✏️'},{id:'pixar',name:'Pixar 3D',emoji:'✨'},{id:'claymation',name:'Claymation',emoji:'🧱'},{id:'pixel',name:'Pixel Art',emoji:'👾'},{id:'bd',name:'BD franco-belge',emoji:'📘'}];
function getStudioStylePrompt(id){const m={cartoon:'classic cartoon style, thick outlines, flat vivid colors',anime:'anime style, cel shading, clean lineart',manga:'black and white manga style, ink outlines',comic:'American comic book style, bold outlines',ghibli:'Studio Ghibli style, hand-painted pastel',simpson:'The Simpsons cartoon style, yellow skin',watercolor:'watercolor painting style',sketch:'pencil sketch style',pixar:'Pixar 3D animation style',claymation:'claymation stop-motion',pixel:'pixel art 16-bit',bd:'Franco-Belgian bande dessinée, ligne claire'};return m[id]||m.cartoon;}

/* WARDROBE */
const WARDROBE={top:{label:'Hauts',emoji:'👕',items:[{id:'none',name:'Aucun',emoji:'🚫',prompt:''},{id:'tshirt',name:'T-shirt',emoji:'👕',prompt:'t-shirt'},{id:'shirt',name:'Chemise',emoji:'👔',prompt:'shirt'},{id:'tank',name:'Débardeur',emoji:'🎽',prompt:'tank top'},{id:'sweater',name:'Pull',emoji:'🧶',prompt:'sweater'},{id:'hoodie',name:'Sweat',emoji:'🧥',prompt:'hoodie'},{id:'croptop',name:'Crop',emoji:'👚',prompt:'crop top'},{id:'polo',name:'Polo',emoji:'👕',prompt:'polo'},{id:'blouse',name:'Blouse',emoji:'👚',prompt:'blouse'},{id:'body',name:'Body',emoji:'🩱',prompt:'bodysuit'},{id:'kimono-top',name:'Kimono',emoji:'👘',prompt:'kimono'},{id:'turtleneck',name:'Col roulé',emoji:'🧣',prompt:'turtleneck'},{id:'leather-jacket',name:'Perfecto',emoji:'🧥',prompt:'leather jacket'},{id:'armor',name:'Armure',emoji:'🛡️',prompt:'armor'}]},bottom:{label:'Bas',emoji:'👖',items:[{id:'none',name:'Aucun',emoji:'🚫',prompt:''},{id:'jeans',name:'Jean',emoji:'👖',prompt:'jeans'},{id:'pants',name:'Pantalon',emoji:'👖',prompt:'trousers'},{id:'shorts',name:'Short',emoji:'🩳',prompt:'shorts'},{id:'skirt',name:'Jupe',emoji:'👗',prompt:'skirt'},{id:'dress',name:'Robe',emoji:'👗',prompt:'dress'},{id:'leggings',name:'Legging',emoji:'🩱',prompt:'leggings'},{id:'pleated',name:'Plissée',emoji:'👗',prompt:'pleated skirt'},{id:'sport-shorts',name:'Sport',emoji:'🩳',prompt:'sport shorts'},{id:'cargo',name:'Cargo',emoji:'👖',prompt:'cargo'},{id:'harem',name:'Sarouel',emoji:'👖',prompt:'harem'},{id:'overall',name:'Salopette',emoji:'👖',prompt:'overalls'},{id:'mini',name:'Mini',emoji:'👗',prompt:'mini skirt'},{id:'hakama',name:'Hakama',emoji:'🥋',prompt:'hakama'}]},shoes:{label:'Chaussures',emoji:'👟',items:[{id:'none',name:'Aucune',emoji:'🚫',prompt:''},{id:'sneakers',name:'Baskets',emoji:'👟',prompt:'sneakers'},{id:'boots',name:'Bottes',emoji:'🥾',prompt:'boots'},{id:'heels',name:'Talons',emoji:'👠',prompt:'heels'},{id:'sandals',name:'Sandales',emoji:'🩴',prompt:'sandals'},{id:'dress-shoes',name:'Ville',emoji:'👞',prompt:'dress shoes'},{id:'combat',name:'Rangers',emoji:'🥾',prompt:'combat boots'},{id:'espadrilles',name:'Espadrilles',emoji:'👟',prompt:'espadrilles'},{id:'loafers',name:'Mocassins',emoji:'👞',prompt:'loafers'},{id:'barefoot',name:'Nus',emoji:'🦶',prompt:'barefoot'}]},hat:{label:'Chapeaux',emoji:'🎩',items:[{id:'none',name:'Aucun',emoji:'🚫',prompt:''},{id:'cap',name:'Casquette',emoji:'🧢',prompt:'cap'},{id:'hat',name:'Chapeau',emoji:'👒',prompt:'hat'},{id:'beret',name:'Béret',emoji:'🎩',prompt:'beret'},{id:'beanie',name:'Bonnet',emoji:'🧢',prompt:'beanie'},{id:'fedora',name:'Fedora',emoji:'🎩',prompt:'fedora'},{id:'bandana',name:'Bandana',emoji:'🧣',prompt:'bandana'},{id:'crown',name:'Couronne',emoji:'👑',prompt:'crown'},{id:'helmet',name:'Casque',emoji:'⛑️',prompt:'helmet'},{id:'witch-hat',name:'Sorcière',emoji:'🧙',prompt:'witch hat'},{id:'cowboy',name:'Cowboy',emoji:'🤠',prompt:'cowboy hat'}]},coat:{label:'Manteaux',emoji:'🧥',items:[{id:'none',name:'Aucun',emoji:'🚫',prompt:''},{id:'jacket',name:'Veste',emoji:'🧥',prompt:'jacket'},{id:'coat',name:'Manteau',emoji:'🧥',prompt:'coat'},{id:'bomber',name:'Blouson',emoji:'🧥',prompt:'bomber'},{id:'leather',name:'Cuir',emoji:'🧥',prompt:'leather'},{id:'cape',name:'Cape',emoji:'🦸',prompt:'cape'},{id:'trench',name:'Trench',emoji:'🧥',prompt:'trench'},{id:'kimono',name:'Kimono',emoji:'👘',prompt:'kimono'},{id:'vest',name:'Gilet',emoji:'🦺',prompt:'vest'}]},accessories:{label:'Accessoires',emoji:'👓',items:[{id:'glasses',name:'Lunettes',emoji:'👓',prompt:'glasses'},{id:'sunglasses',name:'Sol.',emoji:'🕶️',prompt:'sunglasses'},{id:'necklace',name:'Collier',emoji:'📿',prompt:'necklace'},{id:'scarf',name:'Écharpe',emoji:'🧣',prompt:'scarf'},{id:'belt',name:'Ceinture',emoji:'👔',prompt:'belt'},{id:'bag',name:'Sac',emoji:'👛',prompt:'bag'},{id:'gloves',name:'Gants',emoji:'🧤',prompt:'gloves'},{id:'watch',name:'Montre',emoji:'⌚',prompt:'watch'},{id:'earrings',name:'Boucles',emoji:'💎',prompt:'earrings'},{id:'chain',name:'Chaîne',emoji:'⛓️',prompt:'chain'},{id:'headphones',name:'Casque',emoji:'🎧',prompt:'headphones'},{id:'sword',name:'Épée',emoji:'⚔️',prompt:'sword'},{id:'staff',name:'Bâton',emoji:'🪄',prompt:'staff'}]}};
const COLORS=[{name:'Noir',hex:'#000000'},{name:'Blanc',hex:'#ffffff'},{name:'Gris',hex:'#808080'},{name:'Anthracite',hex:'#36454f'},{name:'Rouge',hex:'#e63946'},{name:'Bordeaux',hex:'#800020'},{name:'Rose',hex:'#ff69b4'},{name:'Orange',hex:'#ff7f50'},{name:'Jaune',hex:'#ffd23f'},{name:'Or',hex:'#ffd700'},{name:'Vert',hex:'#2d8a4e'},{name:'Menthe',hex:'#98ff98'},{name:'Turquoise',hex:'#40e0d0'},{name:'Cyan',hex:'#00bcd4'},{name:'Bleu',hex:'#4169e1'},{name:'Marine',hex:'#000080'},{name:'Violet',hex:'#9370db'},{name:'Pourpre',hex:'#8b008b'},{name:'Marron',hex:'#8b4513'},{name:'Beige',hex:'#f5f5dc'},{name:'Néon rose',hex:'#ff10f0'},{name:'Néon vert',hex:'#39ff14'},{name:'Néon cyan',hex:'#0ff0fc'}];
function newWardrobe(){return{top:null,bottom:null,shoes:null,hat:null,coat:null,accessories:[]};}
function buildWardrobeDescription(w){if(!w)return'';const parts=[];const getItem=(cat,id)=>WARDROBE[cat].items.find(i=>i.id===id);const cn=(hex)=>{const f=COLORS.find(c=>c.hex.toLowerCase()===hex.toLowerCase());return f?f.name:hex;};if(w.coat){const it=getItem('coat',w.coat.itemId);if(it&&it.prompt)parts.push(`${cn(w.coat.color)} ${it.prompt}`);}if(w.top){const it=getItem('top',w.top.itemId);if(it&&it.prompt)parts.push(`${cn(w.top.color)} ${it.prompt}`);}if(w.bottom){const it=getItem('bottom',w.bottom.itemId);if(it&&it.prompt)parts.push(`${cn(w.bottom.color)} ${it.prompt}`);}if(w.shoes){const it=getItem('shoes',w.shoes.itemId);if(it&&it.prompt)parts.push(`${cn(w.shoes.color)} ${it.prompt}`);}if(w.hat){const it=getItem('hat',w.hat.itemId);if(it&&it.prompt)parts.push(`${cn(w.hat.color)} ${it.prompt}`);}(w.accessories||[]).forEach(a=>{const it=getItem('accessories',a.itemId);if(it&&it.prompt)parts.push(`${cn(a.color)} ${it.prompt}`);});return parts.join(', ');}

/* HASHTAGS */
function generateHashtags(){const style=state.studioStyle||'cartoon';const platform=document.getElementById('hashtags-platform').value;const lang=document.getElementById('hashtags-lang').value;const t=parseInt(document.getElementById('hashtags-count').value,10)||25;const pool=new Set();['cartoon','animation','characterdesign','aiart','viral','trending','art','creative','3dmodel','vr'].forEach(h=>pool.add(h));if(platform==='tiktok'||platform==='all')['fyp','foryou','viral','trending','tiktok','pourtoi','tendance'].forEach(h=>pool.add(h));if(platform==='youtube'||platform==='all')['shorts','youtubeshorts','youtube'].forEach(h=>pool.add(h));if(platform==='instagram'||platform==='all')['reels','explorepage','instagram'].forEach(h=>pool.add(h));(document.getElementById('hashtags-custom').value||'').split(',').map(s=>s.trim().toLowerCase().replace(/[^a-z0-9]/gi,'')).filter(s=>s.length>1).forEach(s=>pool.add(s));state.characters.forEach(c=>{if(c.name)pool.add(c.name.toLowerCase().replace(/[^a-z0-9]/gi,''));});const arr=Array.from(pool).sort(()=>Math.random()-.5).slice(0,t);return arr.map(h=>'#'+h);}
function renderHashtags(tags){state.currentHashtags=tags;document.getElementById('hashtag-count').textContent=tags.length+' hashtags';document.getElementById('hashtag-zone').classList.add('visible');const list=document.getElementById('hashtag-list');list.innerHTML=tags.map(t=>`<span class="hashtag-chip" data-tag="${esc(t)}">${esc(t)}</span>`).join('');list.querySelectorAll('.hashtag-chip').forEach(c=>c.onclick=()=>{copyText(c.dataset.tag).then(()=>{c.classList.add('copied');c.textContent='✓ '+c.dataset.tag;setTimeout(()=>{c.classList.remove('copied');c.textContent=c.dataset.tag;},900);});});}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch(e){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e2){}document.body.removeChild(ta);return true;}}
async function copyAllHashtags(){if(!state.currentHashtags.length)return;await copyText(state.currentHashtags.join(' '));showToast('✓ Copié','success');}
function downloadHashtagsTxt(){if(!state.currentHashtags.length)return;const c=state.currentHashtags.join(' ')+'\n\n'+state.currentHashtags.join('\n');const b=new Blob([c],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='hashtags-'+Date.now()+'.txt';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(u),5000);showToast('.txt téléchargé','success');}
function getApiKey(){return (document.getElementById('api-key-global')?.value?.trim()||'');}
function fileToDataUri(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(f);});}
async function makeThumbnail(src,maxSize=200){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{try{const c=document.createElement('canvas'),r=img.height/img.width;c.width=maxSize;c.height=Math.round(maxSize*r);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.7));}catch(e){resolve(src);}};img.onerror=()=>resolve(null);img.src=src;});}

/* ENVIRONNEMENTS VR */
const ENVIRONMENTS={
dark:{name:'Studio Sombre',emoji:'🌑',desc:'Fond neutre pro',bg:0x0a0a14,fog:null,lighting:{ambient:0.7,key:1,rim:1.5,fill:1}},
studio:{name:'Studio Photo',emoji:'📸',desc:'Fond blanc doux',bg:0xf0f0f5,fog:null,lighting:{ambient:0.9,key:1.5,rim:0.5,fill:1.2}},
beach:{name:'Plage',emoji:'🏖️',desc:'Sable et ciel bleu',bg:0x87ceeb,fog:{color:0x87ceeb,near:5,far:25},lighting:{ambient:1,key:1.8,rim:0.8,fill:1.5},ground:{color:0xf5deb3,texture:'sand'}},
cyberpunk:{name:'Cyberpunk',emoji:'🌃',desc:'Néon et pluie',bg:0x080014,fog:{color:0x1a0033,near:3,far:20},lighting:{ambient:0.5,key:0.8,rim:2.5,fill:2},ground:{color:0x1a1a2e,texture:'wet'},particles:true},
space:{name:'Espace',emoji:'🌌',desc:'Étoiles et nébuleuse',bg:0x000005,fog:null,lighting:{ambient:0.4,key:1.2,rim:1,fill:0.8},stars:true},
forest:{name:'Forêt',emoji:'🌲',desc:'Sous-bois',bg:0x1a3a1a,fog:{color:0x2a4a2a,near:4,far:22},lighting:{ambient:0.8,key:1.3,rim:0.6,fill:0.9},ground:{color:0x2a5a2a,texture:'grass'}},
nightcity:{name:'Ville Nuit',emoji:'🌉',desc:'Lumières urbaines',bg:0x050510,fog:{color:0x0a0a1a,near:5,far:30},lighting:{ambient:0.6,key:0.9,rim:1.8,fill:1.2},ground:{color:0x1a1a2a,texture:'asphalt'}}
};

/* ═══════════════════════════════════════════════════════════════
   THREE.JS VIEWER
   ═══════════════════════════════════════════════════════════════ */
async function initThreeViewer(containerId,imageUrl,options={}){
if(!imageUrl){document.getElementById(containerId).innerHTML='<div class="three-loading">Aucune image</div>';return;}
if(state.threeInstances[containerId])disposeThree(containerId);

const wrapper=document.getElementById(containerId);
const w=wrapper.clientWidth||400,h=wrapper.clientHeight||400;
wrapper.innerHTML='<div class="three-loading"><div class="spinner"></div><div>Chargement 3D…</div></div>';

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45,w/h,.1,1000);
camera.position.set(0,0,4);

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(w,h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.xr.enabled=true;
wrapper.innerHTML='';
wrapper.appendChild(renderer.domElement);

// Environment
const env=ENVIRONMENTS[state.envPreset]||ENVIRONMENTS.dark;
scene.background=new THREE.Color(env.bg);
if(env.fog)scene.fog=new THREE.Fog(env.fog.color,env.fog.near,env.fog.far);

// Lights
scene.add(new THREE.AmbientLight(0xffffff,env.lighting.ambient));
const key=new THREE.DirectionalLight(0xffffff,env.lighting.key);key.position.set(2,2,3);scene.add(key);
const rim=new THREE.DirectionalLight(0xa855f7,env.lighting.rim);rim.position.set(-2,-1,-3);scene.add(rim);
const fill=new THREE.PointLight(0x22d3ee,env.lighting.fill,10);fill.position.set(0,2,1);scene.add(fill);

// Texture
let texture=null;
try{texture=await new Promise((res,rej)=>{const l=new THREE.TextureLoader();l.setCrossOrigin('anonymous');l.load(imageUrl,res,undefined,rej);});texture.encoding=THREE.sRGBEncoding;}catch(e){wrapper.innerHTML='<div class="three-loading">⚠️ Erreur CORS</div>';return;}

// Group avec profondeur
const group=new THREE.Group();
[{z:-.35,s:1.25,o:.25,c:0xa855f7},{z:-.20,s:1.15,o:.55,c:0xec4899},{z:-.10,s:1.05,o:.85,c:0x6366f1}].forEach(cfg=>{
const g=new THREE.PlaneGeometry(1.5*cfg.s,1.5*cfg.s);
const m=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:cfg.o,color:cfg.c});
const mesh=new THREE.Mesh(g,m);mesh.position.z=cfg.z;group.add(mesh);
});
const mainGeom=new THREE.BoxGeometry(1.5,1.5,.05);
const mainMat=[new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({map:texture,emissive:0x111122,emissiveIntensity:.3}),new THREE.MeshStandardMaterial({color:0x111122})];
const mainMesh=new THREE.Mesh(mainGeom,mainMat);group.add(mainMesh);
const glowG=new THREE.CircleGeometry(1.4,32);
const glowM=new THREE.MeshBasicMaterial({color:0xa855f7,transparent:true,opacity:.15});
const glow=new THREE.Mesh(glowG,glowM);glow.position.z=-.5;group.add(glow);

// Ground selon env
if(env.ground){
const floorG=new THREE.PlaneGeometry(20,20);
const floorM=new THREE.MeshStandardMaterial({color:env.ground.color,metalness:env.ground.texture==='wet'?.9:.3,roughness:env.ground.texture==='wet'?.1:.8,transparent:true,opacity:.7});
const floor=new THREE.Mesh(floorG,floorM);floor.rotation.x=-Math.PI/2;floor.position.y=-1.1;scene.add(floor);
}

// Étoiles
if(env.stars){
const sg=new THREE.BufferGeometry();
const pos=[];
for(let i=0;i<2000;i++){pos.push((Math.random()-.5)*200,(Math.random()-.5)*200,(Math.random()-.5)*200);}
sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
const sm=new THREE.PointsMaterial({color:0xffffff,size:.5,transparent:true});
scene.add(new THREE.Points(sg,sm));
}

// Particules pluie (cyberpunk)
if(env.particles){
const pg=new THREE.BufferGeometry();
const pp=[];
for(let i=0;i<800;i++){pp.push((Math.random()-.5)*20,(Math.random()-.5)*20,(Math.random()-.5)*20);}
pg.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));
const pm=new THREE.PointsMaterial({color:0x22d3ee,size:.05,transparent:true,opacity:.6});
scene.add(new THREE.Points(pg,pm));
}

scene.add(group);

const inst={scene,camera,renderer,group,mainMesh,texture,rotY:0,rotX:0,scale:1,motion:'rotate',isPlaying:true,startTime:performance.now(),mouse:{down:false,x:0,y:0}};
state.threeInstances[containerId]=inst;

// Mouse
const el=renderer.domElement;
el.addEventListener('mousedown',e=>{inst.mouse.down=true;inst.mouse.x=e.clientX;inst.mouse.y=e.clientY;});
window.addEventListener('mousemove',e=>{if(!inst.mouse.down)return;const dx=e.clientX-inst.mouse.x,dy=e.clientY-inst.mouse.y;inst.rotY+=dx*.008;inst.rotX+=dy*.008;inst.rotX=Math.max(-Math.PI/3,Math.min(Math.PI/3,inst.rotX));inst.mouse.x=e.clientX;inst.mouse.y=e.clientY;});
window.addEventListener('mouseup',()=>{inst.mouse.down=false;});
el.addEventListener('touchstart',e=>{if(e.touches.length===1){inst.mouse.down=true;inst.mouse.x=e.touches[0].clientX;inst.mouse.y=e.touches[0].clientY;}},{passive:true});
el.addEventListener('touchmove',e=>{if(e.touches.length===1&&inst.mouse.down){const dx=e.touches[0].clientX-inst.mouse.x,dy=e.touches[0].clientY-inst.mouse.y;inst.rotY+=dx*.008;inst.rotX+=dy*.008;inst.rotX=Math.max(-Math.PI/3,Math.min(Math.PI/3,inst.rotX));inst.mouse.x=e.touches[0].clientX;inst.mouse.y=e.touches[0].clientY;}},{passive:true});
el.addEventListener('touchend',()=>{inst.mouse.down=false;});

// Resize
new ResizeObserver(()=>{const nw=wrapper.clientWidth,nh=wrapper.clientHeight;if(nw>0&&nh>0){camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);}}).observe(wrapper);

// Animation
const clock=new THREE.Clock();
function animate(){
const dt=clock.getDelta();const t=performance.now()-inst.startTime;
if(inst.isPlaying){
switch(inst.motion){
case 'rotate':inst.rotY+=dt*.8;break;
case 'float':group.position.y=Math.sin(t*.002)*.1;inst.rotY+=dt*.4;break;
case 'zoom':inst.scale=.9+Math.sin(t*.0015)*.15;break;
case 'shake':group.position.x=Math.sin(t*.02)*.02;group.position.y=Math.cos(t*.018)*.02;break;
case 'pulse':{const p=1+Math.sin(t*.003)*.05;group.scale.set(p,p,p);break;}
case 'spin':inst.rotY+=dt*3;break;
}
}
group.rotation.y=inst.rotY;group.rotation.x=inst.rotX;
if(inst.motion!=='pulse')group.scale.set(inst.scale,inst.scale,inst.scale);
renderer.render(scene,camera);
if(!renderer.xr.isPresenting)requestAnimationFrame(animate);
}
renderer.setAnimationLoop(()=>{if(renderer.xr.isPresenting){inst.rotY+=.008;group.rotation.y=inst.rotY;renderer.render(scene,camera);}});
requestAnimationFrame(animate);
}
function disposeThree(id){const i=state.threeInstances[id];if(!i)return;try{i.renderer.dispose();i.texture?.dispose();}catch(e){}delete state.threeInstances[id];}

/* ═══ EXPORTS GLB / STL / OBJ ═══ */
function exportModel(containerId,name,format){
const inst=state.threeInstances[containerId];
if(!inst){showToast('Viewer non initialisé','error');return;}
try{
const clone=inst.group.clone(true);clone.rotation.set(0,0,0);clone.position.set(0,0,0);clone.scale.set(1,1,1);
const ts=Date.now();const fname=(name||'model').replace(/[^a-z0-9]/gi,'_');
if(format==='glb'){
new THREE.GLTFExporter().parse(clone,(r)=>{const b=new Blob([r],{type:'model/gltf-binary'});downloadBlob(b,fname+'-'+ts+'.glb');showToast('✅ GLB téléchargé','success',3000);},(e)=>showToast('Erreur GLB','error'),{binary:true,embedImages:true});
}else if(format==='stl'){
const r=new THREE.STLExporter().parse(clone,{binary:true});const b=new Blob([r],{type:'model/stl'});downloadBlob(b,fname+'-'+ts+'.stl');showToast('✅ STL téléchargé — prêt pour impression 3D','success',3000);
}else if(format==='obj'){
const r=new THREE.OBJExporter().parse(clone);const b=new Blob([r],{type:'model/obj'});downloadBlob(b,fname+'-'+ts+'.obj');showToast('✅ OBJ téléchargé','success',3000);
}
}catch(e){console.error(e);showToast('Erreur export : '+e.message,'error',4000);}
}
function downloadBlob(blob,filename){
const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(u),10000);
}

/* ═══ AUDIO 3D ANIMATION ═══ */
async function record3DAnimation(containerId,charName,motion,duration=6){
const inst=state.threeInstances[containerId];
if(!inst){showToast('Viewer non initialisé','error');return;}

inst.motion=motion;inst.isPlaying=true;inst.rotY=0;inst.rotX=0;inst.scale=1;
inst.group.rotation.set(0,0,0);inst.group.position.set(0,0,0);inst.group.scale.set(1,1,1);

await sleep(100);

const canvas=inst.renderer.domElement;
const canvasStream=canvas.captureStream(30);
const streams=[canvasStream];

// Ajouter audio si présent
let audioCtx=null,audioSource=null;
if(state.recordingAudioFile){
try{
audioCtx=new (window.AudioContext||window.webkitAudioContext)();
const audioEl=document.getElementById('audio-preview');
audioEl.src=URL.createObjectURL(state.recordingAudioFile);
audioEl.loop=false;audioEl.currentTime=0;
audioSource=audioCtx.createMediaElementSource(audioEl);
const dest=audioCtx.createMediaStreamDestination();
audioSource.connect(dest);audioSource.connect(audioCtx.destination);
streams.push(dest.stream);
await audioEl.play();
}catch(e){console.warn('Audio error:',e);}
}

const combined=new MediaStream();
streams.forEach(s=>s.getAudioTracks().forEach(t=>combined.addTrack(t)));
streams.forEach(s=>s.getVideoTracks().forEach(t=>combined.addTrack(t)));

const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'video/webm';
const rec=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:6000000});
const chunks=[];rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};

document.getElementById('progress-zone').classList.add('visible');
setProgress('Enregistrement animation…',10);
rec.start(200);

const start=Date.now();
const pi=setInterval(()=>{setProgress(`Enregistrement — ${motion}…`,Math.min(99,((Date.now()-start)/(duration*1000))*90+10));},100);

await sleep(duration*1000);
clearInterval(pi);setProgress('Finalisation…',95);
rec.stop();
await new Promise(r=>{rec.onstop=r;});

if(audioSource){try{audioSource.disconnect();}catch(e){}}if(audioCtx){try{audioCtx.close();}catch(e){}}

const blob=new Blob(chunks,{type:mime});
downloadBlob(blob,(charName||'animation').replace(/[^a-z0-9]/gi,'_')+'-'+motion+'-'+Date.now()+'.webm');
setProgress('Animation exportée ✓',100);
setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),1500);
showToast('🎬 Animation téléchargée','success',3500);
}

/* ═══ VR ═══ */
async function enterVR(containerId){
const inst=state.threeInstances[containerId];
if(!inst){showToast('Viewer non initialisé','error');return;}

if(navigator.xr&&inst.renderer.xr){
try{
const supported=await navigator.xr.isSessionSupported('immersive-vr');
if(supported){
const session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking']});
await inst.renderer.xr.setSession(session);
state.vrSession=session;state.vrActive=true;state.vrMode='native';
session.addEventListener('end',()=>{state.vrSession=null;state.vrActive=false;});
inst.camera.position.set(0,1.6,3);
showToast('🥽 VR activé','success',4000);
return;
}
}catch(e){console.warn(e);}
}
launchSimulatedVR(containerId);
}
async function launchSimulatedVR(containerId){
const inst=state.threeInstances[containerId];
if(!inst)return;
const fs=document.getElementById('vr-fullscreen');const hud=document.getElementById('vr-hud');
fs.classList.add('active');
const vrRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
vrRenderer.setSize(window.innerWidth,window.innerHeight);
vrRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
fs.querySelectorAll('canvas').forEach(c=>c.remove());
vrRenderer.domElement.style.cssText='position:absolute;top:0;left:0;z-index:1;';
fs.appendChild(vrRenderer.domElement);
const scene=inst.scene;const camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,.1,1000);
let gyroA=0,gyroB=0,gyroG=0,gyro=false;
function handleGyro(e){gyro=true;gyroA=e.alpha||0;gyroB=e.beta||0;gyroG=e.gamma||0;}
if(window.DeviceOrientationEvent){
if(typeof DeviceOrientationEvent.requestPermission==='function'){
try{const p=await DeviceOrientationEvent.requestPermission();if(p==='granted')window.addEventListener('deviceorientation',handleGyro);}catch(e){}
}else{window.addEventListener('deviceorientation',handleGyro);}
}
let drag=false,lx=0,ly=0,ty=0,tp=0,cy=0,cp=0;
const el=vrRenderer.domElement;
el.addEventListener('mousedown',e=>{drag=true;lx=e.clientX;ly=e.clientY;});
el.addEventListener('mousemove',e=>{if(!drag)return;ty-=(e.clientX-lx)*.005;tp-=(e.clientY-ly)*.005;tp=Math.max(-Math.PI/3,Math.min(Math.PI/3,tp));lx=e.clientX;ly=e.clientY;});
el.addEventListener('mouseup',()=>{drag=false;});
el.addEventListener('touchstart',e=>{if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}},{passive:true});
el.addEventListener('touchmove',e=>{if(e.touches.length===1&&drag){ty-=(e.touches[0].clientX-lx)*.005;tp-=(e.touches[0].clientY-ly)*.005;tp=Math.max(-Math.PI/3,Math.min(Math.PI/3,tp));lx=e.touches[0].clientX;ly=e.touches[0].clientY;}},{passive:true});
el.addEventListener('touchend',()=>{drag=false;});
let lt=performance.now();
function loop(){
if(!fs.classList.contains('active'))return;
const now=performance.now();const dt=(now-lt)/1000;lt=now;
if(inst.group)inst.group.rotation.y+=dt*.3;
let y=ty,p=tp;
if(gyro){y=-(gyroA*Math.PI/180);p=((gyroB-90)*Math.PI/180);p=Math.max(-Math.PI/3,Math.min(Math.PI/3,p));}
cy+=(y-cy)*.1;cp+=(p-cp)*.1;
const r=2.5;
camera.position.set(Math.sin(cy)*Math.cos(cp)*r,Math.sin(cp)*r,Math.cos(cy)*Math.cos(cp)*r);
camera.lookAt(0,0,0);
vrRenderer.render(scene,camera);
requestAnimationFrame(loop);
}
loop();
state.vrActive=true;state.vrMode='simulated';state.vrRenderer=vrRenderer;
hud.textContent='📱 Bougez l\'appareil · 👆 Glissez';
showToast('🥽 VR simulé activé','success',3000);
}
function exitVR(){
const fs=document.getElementById('vr-fullscreen');fs.classList.remove('active');
if(state.vrSession){state.vrSession.end().catch(()=>{});state.vrSession=null;}
if(state.vrRenderer){try{state.vrRenderer.dispose();}catch(e){}state.vrRenderer=null;}
state.vrActive=false;showToast('VR désactivée','warn');
}

/* ═══════════════════════════════════════════════════════════════
   MULTI-SCENE 3D
   ═══════════════════════════════════════════════════════════════ */
function openMultiScene(){
const ready=state.characters.filter(c=>c.wardrobeValidated);
if(ready.length<1){showToast('Créez au moins un personnage validé','warn');return;}
let container=document.getElementById('multi-scene-container');
if(!container){container=document.createElement('div');container.id='multi-scene-container';const sc=document.getElementById('scene-cards');if(sc)sc.parentNode.insertBefore(container,sc);}
container.innerHTML=`
<div class="multi-scene-panel">
<div class="multi-scene-title">👥 Scène 3D multi-personnages</div>
<div class="note" style="margin-bottom:.6rem;color:var(--ink-dim);">Cliquez sur les personnages à ajouter. Faites glisser pour tourner la scène.</div>
<div class="scene-char-select">
${state.characters.map(c=>`
<div class="scene-char-option ${c.wardrobeValidated?'':'disabled'}" data-multi-char="${c.id}">
${c.thumbnail?`<img src="${c.thumbnail}" alt="">`:''}
<div class="scene-char-name">${esc(c.name||'?')}</div>
${c.wardrobeValidated?'<span class="scene-char-ready">✓</span>':'<span class="scene-char-blocked">!</span>'}
</div>`).join('')}
</div>
<div class="multi-scene-canvas" id="multi-canvas"></div>
<div style="display:flex;gap:.5rem;margin-bottom:.6rem;">
<button class="btn-secondary" id="multi-record-btn" style="flex:1;margin:0;background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;border:none;">🎬 Enregistrer la scène 3D</button>
<button class="btn-secondary" id="multi-close-btn" style="flex:0 0 100px;margin:0;">✕ Fermer</button>
</div>
<div class="note" style="text-align:center;">💡 Combinez plusieurs personnages dans un même espace 3D</div>
</div>`;

state.multiScene={selected:[],scene:null,camera:null,renderer:null,group:null,rotY:0,playing:true};

container.querySelectorAll('[data-multi-char]').forEach(el=>{
if(el.classList.contains('disabled'))return;
el.onclick=()=>{
const cid=el.dataset.multiChar;
const idx=state.multiScene.selected.indexOf(cid);
if(idx>=0)state.multiScene.selected.splice(idx,1);
else if(state.multiScene.selected.length<4)state.multiScene.selected.push(cid);
else{showToast('Maximum 4 personnages','warn');return;}
rebuildMultiScene();
};
});

document.getElementById('multi-close-btn').onclick=()=>{container.innerHTML='';state.multiScene=null;};
document.getElementById('multi-record-btn').onclick=()=>recordMultiScene();
}
function rebuildMultiScene(){
if(!state.multiScene)return;
const wrap=document.getElementById('multi-canvas');if(!wrap)return;
if(state.multiScene.renderer){try{state.multiScene.renderer.dispose();}catch(e){}}
const w=wrap.clientWidth||600,h=wrap.clientHeight||340;
const scene=new THREE.Scene();
const env=ENVIRONMENTS[state.envPreset]||ENVIRONMENTS.dark;
scene.background=new THREE.Color(env.bg);
if(env.fog)scene.fog=new THREE.Fog(env.fog.color,env.fog.near,env.fog.far);
scene.add(new THREE.AmbientLight(0xffffff,env.lighting.ambient));
const k=new THREE.DirectionalLight(0xffffff,env.lighting.key);k.position.set(3,4,5);scene.add(k);
const r=new THREE.DirectionalLight(0xa855f7,env.lighting.rim);r.position.set(-3,-2,-4);scene.add(r);
const camera=new THREE.PerspectiveCamera(50,w/h,.1,1000);
camera.position.set(0,1.5,5);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(w,h);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
wrap.innerHTML='';wrap.appendChild(renderer.domElement);
const group=new THREE.Group();scene.add(group);

// Sol
const fg=new THREE.PlaneGeometry(20,20);
const fm=new THREE.MeshStandardMaterial({color:env.ground?.color||0x1a1a2a,metalness:.3,roughness:.7,transparent:true,opacity:.6});
const floor=new THREE.Mesh(fg,fm);floor.rotation.x=-Math.PI/2;floor.position.y=-1.5;scene.add(floor);

// Charger textures
const promises=state.multiScene.selected.map(async(cid,i)=>{
const c=state.characters.find(x=>x.id===cid);if(!c)return;
const img=c.generatedImage||c.thumbnail;if(!img)return;
const tex=await new Promise((res,rej)=>{const l=new THREE.TextureLoader();l.setCrossOrigin('anonymous');l.load(img,res,undefined,rej);});
tex.encoding=THREE.sRGBEncoding;
const spread=(state.multiScene.selected.length-1)*.9;
const x=-spread/2+i*.9;
const g=new THREE.BoxGeometry(.8,.8,.05);
const mats=[new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({color:0x222233}),new THREE.MeshStandardMaterial({map:tex,emissive:0x111122,emissiveIntensity:.3}),new THREE.MeshStandardMaterial({color:0x111122})];
const mesh=new THREE.Mesh(g,mats);
mesh.position.set(x,0,0);
mesh.userData={name:c.name||'?',baseY:0,offset:Math.random()*Math.PI*2};
group.add(mesh);
});
Promise.all(promises).then(()=>{
const clock=new THREE.Clock();
function loop(){
const dt=clock.getDelta();const t=performance.now();
if(state.multiScene.playing){group.rotation.y+=dt*.4;}
group.children.forEach(m=>{if(m.userData.baseY!==undefined){m.position.y=Math.sin(t*.001+m.userData.offset)*.1;}});
renderer.render(scene,camera);
if(state.multiScene){requestAnimationFrame(loop);}
}
loop();
});

let drag=false,lx=0;
renderer.domElement.addEventListener('mousedown',e=>{drag=true;lx=e.clientX;});
window.addEventListener('mousemove',e=>{if(!drag||!state.multiScene)return;group.rotation.y+=(e.clientX-lx)*.01;lx=e.clientX;});
window.addEventListener('mouseup',()=>{drag=false;});
renderer.domElement.addEventListener('touchstart',e=>{if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;}},{passive:true});
renderer.domElement.addEventListener('touchmove',e=>{if(e.touches.length===1&&drag&&state.multiScene){group.rotation.y+=(e.touches[0].clientX-lx)*.01;lx=e.touches[0].clientX;}},{passive:true});
renderer.domElement.addEventListener('touchend',()=>{drag=false;});

state.multiScene.scene=scene;state.multiScene.camera=camera;state.multiScene.renderer=renderer;state.multiScene.group=group;
}
async function recordMultiScene(){
if(!state.multiScene||!state.multiScene.renderer){showToast('Scène non prête','warn');return;}
const canvas=state.multiScene.renderer.domElement;
const stream=canvas.captureStream(30);
const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'video/webm';
const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
const chunks=[];rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
document.getElementById('progress-zone').classList.add('visible');
setProgress('Enregistrement scène 3D…',10);
rec.start(200);
const start=Date.now();
const pi=setInterval(()=>{setProgress('Enregistrement 3D…',Math.min(99,((Date.now()-start)/8000)*100));},100);
await sleep(8000);
clearInterval(pi);rec.stop();
await new Promise(r=>{rec.onstop=r;});
downloadBlob(new Blob(chunks,{type:mime}),'multi-scene-3d-'+Date.now()+'.webm');
setProgress('Terminé ✓',100);
setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),1500);
showToast('🎬 Scène 3D téléchargée','success',3500);
}

/* ═══════════════════════════════════════════════════════════════
   FILE SYSTEM API
   ═══════════════════════════════════════════════════════════════ */
async function saveToFolder(){
if(!state.outputBlob){showToast('Aucune vidéo','error');return;}
if(!window.showSaveFilePicker){showToast('API non supportée','warn');return;}
try{
const handle=await window.showSaveFilePicker({suggestedName:'cartoon-'+Date.now()+'.webm',types:[{description:'Vidéo WebM',accept:{'video/webm':['.webm']}}]});
const writable=await handle.createWritable();
await writable.write(state.outputBlob);
await writable.close();
showToast('✅ Enregistré dans le dossier','success',3000);
}catch(e){if(e.name!=='AbortError')showToast('Erreur : '+e.message,'error');}
}

/* ═══════════════════════════════════════════════════════════════
   LIBRARY & STUDIO
   ═══════════════════════════════════════════════════════════════ */
function getCharacterStage(c){if(c.wardrobeValidated&&c.validatedWardrobe)return{id:'ready',label:'✅ PRÊT'};if(c.validated)return{id:'identity',label:'🔒 Identité'};if(c.generatedImage)return{id:'generated',label:'🎨 Fiche'};return{id:'draft',label:'✏️ Brouillon'};}
function renderLibrary(){
document.getElementById('lib-count-badge').textContent=state.characters.length;
const grid=document.getElementById('lib-grid');
if(!state.characters.length){grid.innerHTML='<div class="lib-empty" style="grid-column:1/-1;"><span class="lib-empty-emoji">🎭</span><div>Aucun personnage.</div></div>';return;}
grid.innerHTML=state.characters.map(c=>{
const thumb=c.thumbnail||c.generatedImage||'';
const st=getCharacterStage(c);
const sc=st.id==='ready'?'ready':st.id==='identity'||st.id==='generated'?'identity':'draft';
return `<div class="lib-card stage-${sc}" data-open="${c.id}">
${thumb?`<img class="lib-thumb" src="${thumb}" alt="">`:'<div class="lib-thumb-placeholder">🎭</div>'}
${thumb?'<span class="lib-3d-badge">🧊 3D</span>':''}
<button class="lib-delete" data-delete="${c.id}">✕</button>
<div class="lib-info"><div class="lib-name">${esc(c.name||'(sans nom)')}</div><span class="lib-stage ${sc}">${st.label}</span>
<div class="lib-meta">${c.savedOutfits.length>0?`<span>👗 ${c.savedOutfits.length}</span>`:''}${c.wardrobeValidated?'<span>✓ Tenue</span>':''}</div></div></div>`;
}).join('');
grid.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openCharacterStudio(el.dataset.open));
grid.querySelectorAll('[data-delete]').forEach(el=>el.onclick=async e=>{e.stopPropagation();const id=el.dataset.delete;const c=state.characters.find(x=>x.id===id);if(!c)return;const ok=await showModal({icon:'🗑️',title:'Supprimer ?',message:`<strong>${esc(c.name||'?')}</strong>`,confirmText:'Supprimer',variant:'danger'});if(!ok)return;state.characters=state.characters.filter(x=>x.id!==id);state.scenes=state.scenes.map(s=>({...s,characterIds:(s.characterIds||[]).filter(cid=>cid!==id)}));saveChars();saveScenes();if(state.openCharacterId===id)closeStudio();renderLibrary();renderScenes();showToast('Supprimé','warn');});
}
function openCharacterStudio(id){state.openCharacterId=id;const c=state.characters.find(x=>x.id===id);if(!c)return;if(!c.activeStudioTab)c.activeStudioTab='identity';if(!c.activeWardrobeTab)c.activeWardrobeTab='top';renderStudio();setTimeout(()=>document.getElementById('studio-panel-container').scrollIntoView({behavior:'smooth',block:'start'}),100);}
function closeStudio(){state.openCharacterId=null;document.getElementById('studio-panel-container').innerHTML='';}

function renderStudio(){
const container=document.getElementById('studio-panel-container');
if(!state.openCharacterId){container.innerHTML='';return;}
const c=state.characters.find(x=>x.id===state.openCharacterId);if(!c){container.innerHTML='';return;}
const tab=c.activeStudioTab||'identity';
const st=getCharacterStage(c);
const canWard=c.validated;
const s1=!!c.generatedImage,s2=c.validated,s3=c.wardrobeValidated;
container.innerHTML=`
<div class="studio-panel">
<div class="studio-panel-header">
<div><div class="studio-panel-title">🎭 Studio de ${esc(c.name||'Personnage')}</div><div class="studio-panel-subtitle">${st.label} ${c.savedOutfits.length>0?`· 👗 ${c.savedOutfits.length}`:''}</div></div>
<button class="studio-panel-close" id="studio-close-btn">✕ Fermer</button>
</div>
<div class="validation-steps">
<span class="vstep ${s1?'done':(tab==='identity'?'active':'')}">${s1?'✅':'1️⃣'} Fiche</span><span class="vstep-arrow">→</span>
<span class="vstep ${s2?'done':(tab==='identity'&&s1?'active':'locked')}">${s2?'🔒':'2️⃣'} Identité</span><span class="vstep-arrow">→</span>
<span class="vstep ${s3?'done':(tab==='wardrobe'?'active':'locked')}">${s3?'✅':'3️⃣'} Tenue</span>
</div>
<div class="studio-tabs">
<button class="studio-tab ${tab==='identity'?'active':''}" data-stab="identity"><span class="studio-tab-emoji">👤</span>Identité${s2?'<span class="studio-tab-lock">🔒</span>':''}</button>
<button class="studio-tab ${tab==='3d'?'active':''}" data-stab="3d" ${s1?'':'disabled'}><span class="studio-tab-emoji">🧊</span>3D</button>
<button class="studio-tab ${tab==='vr'?'active':''}" data-stab="vr" ${s1?'':'disabled'}><span class="studio-tab-emoji">🥽</span>VR</button>
<button class="studio-tab ${tab==='env'?'active':''}" data-stab="env" ${s1?'':'disabled'}><span class="studio-tab-emoji">🌍</span>Env.</button>
<button class="studio-tab ${tab==='wardrobe'?'active':''}" data-stab="wardrobe" ${canWard?'':'disabled'}><span class="studio-tab-emoji">👕</span>Garde-robe${s3?'<span class="studio-tab-check">✓</span>':''}</button>
<button class="studio-tab ${tab==='outfits'?'active':''}" data-stab="outfits" ${canWard?'':'disabled'}><span class="studio-tab-emoji">👗</span>Tenues</button>
</div>
<div class="studio-tab-content ${tab==='identity'?'active':''}">${renderIdentityTab(c)}</div>
<div class="studio-tab-content ${tab==='3d'?'active':''}">${render3DTab(c)}</div>
<div class="studio-tab-content ${tab==='vr'?'active':''}">${renderVRTab(c)}</div>
<div class="studio-tab-content ${tab==='env'?'active':''}">${renderEnvTab()}</div>
<div class="studio-tab-content ${tab==='wardrobe'?'active':''}">${canWard?renderWardrobeTab(c):'<div class="outfit-empty">🔒 Validez l\'identité.</div>'}</div>
<div class="studio-tab-content ${tab==='outfits'?'active':''}">${canWard?renderOutfitsTab(c):'<div class="outfit-empty">🔒 Identité non validée.</div>'}</div>
</div>`;
document.getElementById('studio-close-btn').onclick=closeStudio;
container.querySelectorAll('[data-stab]').forEach(b=>{if(b.disabled)return;b.onclick=()=>{c.activeStudioTab=b.dataset.stab;renderStudio();};});
bindStudio(c);
if(tab==='3d')setTimeout(()=>{const img=c.generatedImage||c.thumbnail;if(img)initThreeViewer('three-canvas-3d',img);},100);
if(tab==='vr')setTimeout(()=>{const img=c.generatedImage||c.thumbnail;if(img)initThreeViewer('three-canvas-vr',img);},100);
if(tab==='env')setTimeout(()=>{const img=c.generatedImage||c.thumbnail;if(img)initThreeViewer('three-canvas-env',img);},100);
}

function renderIdentityTab(c){
const thumb=c.thumbnail||c.generatedImage||'';
const s1=!!c.generatedImage,s2=c.validated;
return `
<div class="identity-card ${s2?'validated':''}">
<div class="identity-grid">
${thumb?`<img class="identity-photo ${s2?'validated':''}" src="${thumb}" alt="">`:'<div class="identity-photo" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--ink-faint);">🎭</div>'}
<div class="identity-info">
<div class="field-row"><label class="field-label">Nom</label><input type="text" id="studio-char-name" value="${esc(c.name)}" placeholder="Léo…"></div>
<div class="identity-meta">${c.description?`<div><strong>Description :</strong> ${esc(c.description)}</div>`:''}${c.appearance?.hair?`<div><strong>Cheveux :</strong> ${esc(c.appearance.hair)}</div>`:''}${c.appearance?.eyes?`<div><strong>Yeux :</strong> ${esc(c.appearance.eyes)}</div>`:''}</div>
</div></div></div>
${s2?`<div class="validated-banner"><span class="validated-icon">🔒</span><div>Identité verrouillée</div></div><button class="btn-secondary" id="studio-unlock-btn" style="border-color:var(--warn);color:var(--warn);margin-top:.6rem;">⚠️ Déverrouiller</button>`:`
<div class="char-create" style="margin-top:.7rem;">
<div class="char-source-toggle">
<div class="char-source-btn ${c.source==='description'?'active':''}" data-ssource="description">✍️ Description</div>
<div class="char-source-btn ${c.source==='photo'?'active':''}" data-ssource="photo">📷 Photo</div>
</div>
<div class="char-grid">
${c.source==='photo'?`<div class="full"><label>Photo</label><label class="file-zone" style="padding:.7rem;"><input type="file" id="studio-photo-input" accept="image/*"><strong>📷 Choisir</strong><span>${c.photoDataUri?'✓ Chargée':'Aucune'}</span></label></div>`:''}
<div class="full"><label>Description</label><textarea id="studio-desc" style="min-height:70px;">${esc(c.description)}</textarea></div>
<div><label>Cheveux</label><input type="text" id="studio-hair" value="${esc(c.appearance?.hair||'')}"></div>
<div><label>Yeux</label><input type="text" id="studio-eyes" value="${esc(c.appearance?.eyes||'')}"></div>
<div><label>Peau</label><input type="text" id="studio-skin" value="${esc(c.appearance?.skin||'')}"></div>
<div><label>Personnalité</label><input type="text" id="studio-personality" value="${esc(c.personality||'')}"></div>
</div>
<button class="btn-primary" id="studio-generate-btn" style="margin-top:.8rem;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;">${s1?'🔄 Régénérer':'🎨 Générer la fiche'}</button>
${s1?`<button class="btn-validate-big" id="studio-validate-btn">🔒 VALIDER L'IDENTITÉ<span class="btn-hint">Définitif</span></button>`:''}
</div>`}`;
}
function render3DTab(c){
const has=c.generatedImage||c.thumbnail;if(!has)return '<div class="outfit-empty">🎨 Générez la fiche.</div>';
return `
<div class="three-viewer-wrap">
<div class="three-viewer-title"><span>🧊 Aperçu 3D</span><span style="font-size:.62rem;color:var(--ink-dim);">THREE.js</span></div>
<div class="three-canvas-wrap" id="three-canvas-3d"><span class="three-badge">3D LIVE</span></div>
<div class="motion-selector">
<button class="motion-btn active" data-motion="rotate"><span class="motion-emoji">🔄</span>Rotate</button>
<button class="motion-btn" data-motion="float"><span class="motion-emoji">🌊</span>Float</button>
<button class="motion-btn" data-motion="zoom"><span class="motion-emoji">🔍</span>Zoom</button>
<button class="motion-btn" data-motion="shake"><span class="motion-emoji">📳</span>Shake</button>
<button class="motion-btn" data-motion="pulse"><span class="motion-emoji">💓</span>Pulse</button>
<button class="motion-btn" data-motion="spin"><span class="motion-emoji">⚡</span>Spin</button>
<button class="motion-btn" data-motion="static"><span class="motion-emoji">⏸️</span>Static</button>
<button class="motion-btn" id="three-reset-btn"><span class="motion-emoji">↺</span>Reset</button>
</div>
</div>
<div class="anim-export-panel">
<div class="anim-export-title">📦 Export modèle 3D</div>
<button class="download-btn glb" id="export-glb-btn">📦 GLB (Blender/Unity)</button>
<button class="download-btn stl" id="export-stl-btn">🖨️ STL (Impression 3D)</button>
<button class="download-btn obj" id="export-obj-btn">📐 OBJ (universel)</button>
</div>
<div class="anim-export-panel" style="border-color:#a855f7;">
<div class="anim-export-title">🎬 Animation 3D avec audio</div>
<label class="file-zone" style="padding:.6rem;margin-bottom:.6rem;">
<input type="file" id="anim-audio-input" accept="audio/*">
<strong>🎵 Musique (optionnel)</strong><span id="anim-audio-name">Aucun fichier</span>
</label>
<div class="anim-options">
<div class="anim-option active" data-anim="rotate"><span class="anim-emoji">🔄</span><div class="anim-name">360°</div></div>
<div class="anim-option" data-anim="float"><span class="anim-emoji">🌊</span><div class="anim-name">Float</div></div>
<div class="anim-option" data-anim="pulse"><span class="anim-emoji">💓</span><div class="anim-name">Pulse</div></div>
<div class="anim-option" data-anim="spin"><span class="anim-emoji">⚡</span><div class="anim-name">Spin</div></div>
</div>
<button class="anim-export-btn" id="record-anim-btn">🎬 ENREGISTRER (6s)<span class="anim-hint">Vidéo WebM 30fps</span></button>
</div>`;
}
function renderVRTab(c){
const has=c.generatedImage||c.thumbnail;if(!has)return '<div class="outfit-empty">🎨 Générez la fiche.</div>';
return `
<div style="background:linear-gradient(135deg,rgba(34,211,238,.1),rgba(8,145,178,.05));border:2px solid var(--cyan);border-radius:14px;padding:1rem;margin-bottom:1rem;">
<div style="display:flex;align-items:center;gap:.6rem;padding:.7rem;background:var(--panel-2);border-radius:10px;margin-bottom:.8rem;font-size:.8rem;">
<span style="width:10px;height:10px;border-radius:50%;background:${navigator.xr?'#10b981':'#d4a017'};"></span>
<span>${navigator.xr?'<strong>WebXR supporté</strong>':'<strong>Mode simulé</strong> (gyroscope)'}</span>
</div>
<button class="btn-validate-big" id="vr-enter-btn" style="background:linear-gradient(135deg,var(--cyan),var(--info));box-shadow:0 6px 24px rgba(34,211,238,.4);">
🥽 ENTRER EN MODE VR
<span class="btn-hint">${navigator.xr?'Session immersive sur casque':'Vue panoramique 360°'}</span>
</button>
</div>
<div class="three-viewer-wrap" style="border-color:var(--purple);">
<div class="three-viewer-title" style="color:#e9d5ff;">📸 Aperçu VR</div>
<div class="three-canvas-wrap" id="three-canvas-vr"><span class="three-badge" style="background:linear-gradient(135deg,var(--purple),var(--pink));">VR</span></div>
</div>`;
}
function renderEnvTab(){
return `
<div class="env-selector">
${Object.entries(ENVIRONMENTS).map(([id,env])=>`
<button class="env-btn ${state.envPreset===id?'active':''}" data-env="${id}">
<span class="env-emoji">${env.emoji}</span>
<div class="env-name">${env.name}</div>
<div class="env-desc">${env.desc}</div>
</button>`).join('')}
</div>
<div class="three-viewer-wrap" style="border-color:var(--cyan);">
<div class="three-viewer-title" style="color:var(--cyan);">🌍 Aperçu de l'environnement</div>
<div class="three-canvas-wrap" id="three-canvas-env"><span class="three-badge">ENV</span></div>
<div class="note" style="text-align:center;margin-top:.5rem;">Les environnements s'appliquent au viewer 3D, VR et scènes multi</div>
</div>`;
}
function renderWardrobeTab(c){
const ct=c.activeWardrobeTab||'top';
const wd=buildWardrobeDescription(c.wardrobe);
const iv=c.wardrobeValidated;
const ivs=iv&&c.validatedWardrobe&&JSON.stringify(c.validatedWardrobe)===JSON.stringify(c.wardrobe);
return `
${iv?`<div class="validated-banner" style="margin-bottom:.8rem;"><span class="validated-icon">✓</span><div><div>Tenue validée</div><div style="font-size:.7rem;opacity:.8;">${ivs?'Prête':'⚠️ Modifiée'}</div></div></div>`:''}
<div class="wardrobe-tabs">
${Object.entries(WARDROBE).map(([key,cat])=>{const h=key==='accessories'?(c.wardrobe.accessories||[]).length>0:!!c.wardrobe[key];return `<div class="wtab ${ct===key?'active':''} ${h?'has-item':''}" data-wtab="${key}"><span class="wtab-emoji">${cat.emoji}</span>${cat.label}</div>`;}).join('')}
</div>
<div class="wtab-panel active">${renderWardrobePanel(c,ct)}</div>
${wd?`<div class="wsummary">👗 <strong>Tenue :</strong> ${esc(wd)}</div>`:'<div class="wsummary" style="text-align:center;">Aucun vêtement</div>'}
<button class="btn-validate-big ${ivs?'validated':''}" id="studio-validate-outfit-btn" ${wd?'':'disabled'} style="${ivs?'background:linear-gradient(135deg,#10b981,#047857);':''}">
${ivs?'✅ TENUE VALIDÉE':'✓ VALIDER CETTE TENUE'}<span class="btn-hint">${ivs?'Cliquez pour re-valider':'Prête pour les scènes'}</span>
</button>
<div style="margin-top:.7rem;">
<button class="btn-secondary" id="studio-save-outfit-btn" ${wd?'':'disabled'} style="border-color:var(--purple);color:#e9d5ff;">💾 Sauvegarder comme modèle</button>
<button class="btn-secondary" id="studio-regen-btn" ${wd?'':'disabled'} style="border-color:var(--pink);color:#f9a8d4;">🔄 Régénérer avec cette tenue</button>
</div>`;
}
function renderWardrobePanel(c,cat){
const cd=WARDROBE[cat];if(!cd)return'';
const isAcc=cat==='accessories',cur=isAcc?null:c.wardrobe[cat];
let h='';
if(!isAcc&&cur){const it=cd.items.find(i=>i.id===cur.itemId);if(it)h+=`<div class="wtab-current"><span class="wtab-current-label">Sélectionné :</span><span class="wtab-current-value">${it.emoji} ${it.name} <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${cur.color};border:1px solid #fff;vertical-align:middle;margin-left:.3rem;"></span></span><button class="wtab-clear" data-witem="${it.id}" data-wcat="${cat}">Retirer</button></div>`;}
if(isAcc&&(c.wardrobe.accessories||[]).length){h+=`<div style="font-size:.72rem;color:var(--ink-dim);margin-bottom:.4rem;">Accessoires (${c.wardrobe.accessories.length}) :</div>`;c.wardrobe.accessories.forEach((a,i)=>{const it=cd.items.find(x=>x.id===a.itemId);if(it)h+=`<div class="wtab-current" style="margin-bottom:.3rem;"><span class="wtab-current-label">${it.emoji} ${it.name}</span><span style="width:14px;height:14px;border-radius:4px;background:${a.color};border:1px solid #fff;display:inline-block;"></span><button class="wtab-clear" data-wremove="${i}">✕</button></div>`;});}
h+='<div class="witems-grid">';
cd.items.forEach(it=>{const s=isAcc?(c.wardrobe.accessories||[]).some(a=>a.itemId===it.id):(cur&&cur.itemId===it.id);h+=`<div class="witem ${s?'selected':''}" data-witem="${it.id}" data-wcat="${cat}"><span class="witem-emoji">${it.emoji}</span><span class="witem-name">${it.name}</span></div>`;});
h+='</div>';
if(isAcc){(c.wardrobe.accessories||[]).forEach((a,i)=>{const it=cd.items.find(x=>x.id===a.itemId);if(!it)return;h+=`<span class="wcolor-label">Couleur de ${it.name}</span><div class="wcolors">`;COLORS.forEach(col=>{const s=a.color.toLowerCase()===col.hex.toLowerCase();h+=`<div class="wcolor ${s?'selected':''}" data-wcolor="${col.hex}" data-wcat="accessories" data-widx="${i}" style="background:${col.hex};" title="${col.name}"></div>`;});h+='</div>';h+=`<input type="text" class="wcustom-input" data-wcustom-input="accessories" data-widx="${i}" value="${a.color}">`;});}
else if(cur){h+='<span class="wcolor-label">Couleur</span><div class="wcolors">';COLORS.forEach(col=>{const s=cur.color.toLowerCase()===col.hex.toLowerCase();h+=`<div class="wcolor ${s?'selected':''}" data-wcolor="${col.hex}" data-wcat="${cat}" style="background:${col.hex};" title="${col.name}"></div>`;});h+='</div>';h+=`<input type="text" class="wcustom-input" data-wcustom-input="${cat}" value="${cur.color}">`;}
else{h+='<div class="note" style="text-align:center;padding:.6rem;">Sélectionnez un vêtement.</div>';}
return h;
}
function renderOutfitsTab(c){
if(!c.savedOutfits.length)return '<div class="outfit-empty">👗 Aucune tenue sauvegardée.</div>';
return `<div class="outfits-grid">${c.savedOutfits.map(o=>{const d=buildWardrobeDescription(o.wardrobe);return `<div class="outfit-card ${o.validated?'validated':''}">${o.thumbnail?`<img class="outfit-thumb" src="${o.thumbnail}" alt="">`:'<div class="outfit-thumb" style="display:flex;align-items:center;justify-content:center;font-size:2rem;">👗</div>'}${o.validated?'<span class="outfit-validated-badge">✓</span>':''}<div class="outfit-info"><div class="outfit-name">${esc(o.name)}</div><div class="outfit-desc">${esc(d||'Aucun')}</div></div><div class="outfit-actions"><button class="outfit-apply" data-apply-outfit="${o.id}">Appliquer</button><button class="outfit-delete" data-delete-outfit="${o.id}">✕</button></div></div>`;}).join('')}</div>`;
}
function bindStudio(c){
const ct=document.getElementById('studio-panel-container');
const ni=document.getElementById('studio-char-name');if(ni)ni.oninput=e=>{c.name=e.target.value;saveChars();};
ct.querySelectorAll('[data-ssource]').forEach(b=>b.onclick=()=>{c.source=b.dataset.ssource;renderStudio();});
const pi=document.getElementById('studio-photo-input');
if(pi)pi.onchange=async e=>{const f=e.target.files[0];if(!f)return;c.photoDataUri=await fileToDataUri(f);renderStudio();showToast('Photo ✓','success');};
['studio-desc','studio-hair','studio-eyes','studio-skin','studio-personality'].forEach(id=>{
const el=document.getElementById(id);if(!el)return;
el.oninput=e=>{if(id==='studio-desc')c.description=e.target.value;else if(id==='studio-personality')c.personality=e.target.value;else{if(!c.appearance)c.appearance={};c.appearance[id.replace('studio-','')]=e.target.value;}saveChars();};
});
const gb=document.getElementById('studio-generate-btn');if(gb)gb.onclick=()=>generateCharacterSheet(c);
const vb=document.getElementById('studio-validate-btn');if(vb)vb.onclick=()=>validateIdentity(c);
const ub=document.getElementById('studio-unlock-btn');if(ub)ub.onclick=()=>unlockIdentity(c);

// 3D
ct.querySelectorAll('.motion-btn[data-motion]').forEach(b=>b.onclick=()=>{
ct.querySelectorAll('.motion-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
const i=state.threeInstances['three-canvas-3d'];if(i){i.motion=b.dataset.motion;i.startTime=performance.now();}
});
const rb=document.getElementById('three-reset-btn');if(rb)rb.onclick=()=>{const i=state.threeInstances['three-canvas-3d'];if(i){i.rotY=0;i.rotX=0;i.scale=1;i.group.position.set(0,0,0);i.group.scale.set(1,1,1);}};
const eg=document.getElementById('export-glb-btn');if(eg)eg.onclick=()=>exportModel('three-canvas-3d',c.name,'glb');
const es=document.getElementById('export-stl-btn');if(es)es.onclick=()=>exportModel('three-canvas-3d',c.name,'stl');
const eo=document.getElementById('export-obj-btn');if(eo)eo.onclick=()=>exportModel('three-canvas-3d',c.name,'obj');

const ai=document.getElementById('anim-audio-input');
if(ai)ai.onchange=e=>{const f=e.target.files[0];if(!f)return;state.recordingAudioFile=f;document.getElementById('anim-audio-name').textContent='🎵 '+f.name;showToast('Audio chargé','success');};

let sAnim='rotate';
ct.querySelectorAll('.anim-option').forEach(o=>o.onclick=()=>{ct.querySelectorAll('.anim-option').forEach(x=>x.classList.remove('active'));o.classList.add('active');sAnim=o.dataset.anim;});
const ra=document.getElementById('record-anim-btn');if(ra)ra.onclick=async()=>{ra.disabled=true;try{await record3DAnimation('three-canvas-3d',c.name,sAnim,6);}catch(e){showToast('Erreur','error');}ra.disabled=false;};

// VR
const ve=document.getElementById('vr-enter-btn');if(ve)ve.onclick=()=>enterVR('three-canvas-vr');

// Env
ct.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{
state.envPreset=b.dataset.env;
ct.querySelectorAll('.env-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
const img=c.generatedImage||c.thumbnail;
if(img)initThreeViewer('three-canvas-env',img);
});

// Wardrobe
ct.querySelectorAll('[data-wtab]').forEach(t=>t.onclick=()=>{c.activeWardrobeTab=t.dataset.wtab;renderStudio();});
ct.querySelectorAll('[data-witem]').forEach(it=>it.onclick=()=>{
const cat=it.dataset.wcat,id=it.dataset.witem;
if(cat==='accessories'){const arr=c.wardrobe.accessories||(c.wardrobe.accessories=[]);const i=arr.findIndex(a=>a.itemId===id);if(i>=0)arr.splice(i,1);else arr.push({itemId:id,color:'#000000'});}
else{if(id==='none')c.wardrobe[cat]=null;else if(c.wardrobe[cat]&&c.wardrobe[cat].itemId===id)c.wardrobe[cat]=null;else c.wardrobe[cat]={itemId:id,color:c.wardrobe[cat]?.color||'#000000'};}
saveChars();renderStudio();
});
ct.querySelectorAll('[data-wremove]').forEach(b=>b.onclick=()=>{c.wardrobe.accessories.splice(parseInt(b.dataset.wremove,10),1);saveChars();renderStudio();});
ct.querySelectorAll('[data-wcolor]').forEach(co=>co.onclick=()=>{const cat=co.dataset.wcat,hex=co.dataset.wcolor,i=co.dataset.widx;if(cat==='accessories'){const n=parseInt(i,10);if(c.wardrobe.accessories[n])c.wardrobe.accessories[n].color=hex;}else if(c.wardrobe[cat])c.wardrobe[cat].color=hex;saveChars();renderStudio();});
ct.querySelectorAll('[data-wcustom-input]').forEach(inp=>inp.oninput=e=>{const cat=inp.dataset.wcustomInput,i=inp.dataset.widx,hex=e.target.value.trim();if(!/^#[0-9a-fA-F]{6}$/.test(hex))return;if(cat==='accessories'){const n=parseInt(i,10);if(c.wardrobe.accessories[n])c.wardrobe.accessories[n].color=hex;}else if(c.wardrobe[cat])c.wardrobe[cat].color=hex;saveChars();});
const vo=document.getElementById('studio-validate-outfit-btn');if(vo)vo.onclick=()=>validateOutfit(c);
const sb=document.getElementById('studio-save-outfit-btn');if(sb)sb.onclick=()=>saveOutfit(c);
const rgb=document.getElementById('studio-regen-btn');if(rgb)rgb.onclick=()=>regenerateWithWardrobe(c);
ct.querySelectorAll('[data-apply-outfit]').forEach(b=>b.onclick=()=>{const o=c.savedOutfits.find(x=>x.id===b.dataset.applyOutfit);if(!o)return;c.wardrobe=JSON.parse(JSON.stringify(o.wardrobe));c.wardrobeValidated=false;c.validatedWardrobe=null;c.activeStudioTab='wardrobe';saveChars();renderStudio();showToast('✓ Appliqué','success');});
ct.querySelectorAll('[data-delete-outfit]').forEach(b=>b.onclick=async()=>{const ok=await showModal({icon:'🗑️',title:'Supprimer ?',message:'Tenue supprimée.',confirmText:'Supprimer',variant:'danger'});if(!ok)return;c.savedOutfits=c.savedOutfits.filter(x=>x.id!==b.dataset.deleteOutfit);saveChars();renderStudio();renderLibrary();showToast('Supprimée','warn');});
}

/* CRÉATION & VALIDATIONS */
function createNewCharacter(){
const c={id:'char_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),name:'',source:'description',photoDataUri:null,description:'',appearance:{hair:'',eyes:'',skin:''},personality:'',generatedImage:null,validatedImage:null,validated:false,wardrobe:newWardrobe(),wardrobeValidated:false,validatedWardrobe:null,savedOutfits:[],thumbnail:null,activeStudioTab:'identity',activeWardrobeTab:'top',createdAt:Date.now()};
state.characters.push(c);saveChars();renderLibrary();openCharacterStudio(c.id);showToast('✨ Créé','success');
}
function buildIdentityPrompt(c){let p=`Character sheet, full body, front view, neutral pose, plain background. ${getStudioStylePrompt(state.studioStyle)}. `;if(c.name)p+=`Name: ${c.name}. `;if(c.description)p+=`Appearance: ${c.description}. `;if(c.appearance?.hair)p+=`Hair: ${c.appearance.hair}. `;if(c.appearance?.eyes)p+=`Eyes: ${c.appearance.eyes}. `;if(c.appearance?.skin)p+=`Skin: ${c.appearance.skin}. `;p+='High quality.';return p;}
async function generateCharacterSheet(c){
const apiKey=getApiKey();if(!apiKey){showToast('Clé API requise','error');return;}
if(!c.description&&!c.photoDataUri){showToast('Remplissez la description','warn');return;}
if(c.validated){const ok=await showModal({icon:'⚠️',title:'Régénérer ?',message:'Déverrouille l\'identité.',confirmText:'Continuer',variant:'danger'});if(!ok)return;c.validated=false;c.validatedImage=null;c.wardrobeValidated=false;c.validatedWardrobe=null;}
document.getElementById('progress-zone').classList.add('visible');setProgress('Génération…',20);
try{
const prompt=buildIdentityPrompt(c);
const body={model:'agnes-image-v1.0',prompt,n:1,size:'1024x1024'};
if(c.source==='photo'&&c.photoDataUri){body.image=c.photoDataUri;body.prompt='Transform this photo into '+getStudioStylePrompt(state.studioStyle)+'. Preserve identity. '+prompt;}
setProgress('Génération…',50);
const res=await fetch('https://apihub.agnes-ai.com/v1/images/generations',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
if(!res.ok){const err=await res.text();if(res.status===404){if(c.source==='photo'&&c.photoDataUri){c.generatedImage=c.photoDataUri;c.thumbnail=await makeThumbnail(c.photoDataUri);saveChars();renderStudio();renderLibrary();showToast('Photo utilisée','warn');document.getElementById('progress-zone').classList.remove('visible');return;}throw new Error('API indisponible');}throw new Error('HTTP '+res.status);}
setProgress('Téléchargement…',80);
const data=await res.json();const url=data.data?.[0]?.url||data.url||data.image_url;
if(!url)throw new Error('Pas d\'image');
c.generatedImage=url;c.thumbnail=await makeThumbnail(url);saveChars();renderStudio();renderLibrary();
setProgress('Fiche générée ✓',100);setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),1000);
showToast('✨ Fiche générée','success',3000);
}catch(e){document.getElementById('progress-zone').classList.remove('visible');showToast('Erreur : '+e.message,'error',4000);}
}
async function validateIdentity(c){
if(!c.generatedImage)return;
const ok=await showModal({icon:'🔒',title:'Verrouiller ?',message:`Identité de <strong>${esc(c.name||'?')}</strong> figée.`,confirmText:'🔒 Verrouiller'});
if(!ok)return;
c.validated=true;c.validatedImage=c.generatedImage;saveChars();renderStudio();renderLibrary();
setTimeout(()=>{c.activeStudioTab='3d';renderStudio();},400);
showToast('🔒 Verrouillée','success',3000);
}
async function unlockIdentity(c){const ok=await showModal({icon:'⚠️',title:'Déverrouiller ?',message:'Le visage pourra changer.',confirmText:'Continuer',variant:'danger'});if(!ok)return;c.validated=false;c.validatedImage=null;c.wardrobeValidated=false;c.validatedWardrobe=null;saveChars();renderStudio();renderLibrary();showToast('Déverrouillé','warn');}
async function validateOutfit(c){
if(!c.validated)return;
const wd=buildWardrobeDescription(c.wardrobe);if(!wd){showToast('Composez une tenue','warn');return;}
const ok=await showModal({icon:'✓',title:'Valider ?',message:`<em style="color:var(--purple);">${esc(wd)}</em>`,confirmText:'✓ Valider'});
if(!ok)return;
c.wardrobeValidated=true;c.validatedWardrobe=JSON.parse(JSON.stringify(c.wardrobe));saveChars();renderStudio();renderLibrary();showToast('✓ Validée','success',3000);
}
async function saveOutfit(c){
const wd=buildWardrobeDescription(c.wardrobe);if(!wd)return;
const name=prompt('Nom :','Tenue '+(c.savedOutfits.length+1));if(!name||!name.trim())return;
c.savedOutfits.push({id:'outfit_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),name:name.trim(),wardrobe:JSON.parse(JSON.stringify(c.wardrobe)),thumbnail:c.generatedImage||c.thumbnail,validated:c.wardrobeValidated,createdAt:Date.now()});
saveChars();renderStudio();renderLibrary();showToast('💾 Sauvegardée','success');
}
async function regenerateWithWardrobe(c){
const apiKey=getApiKey();if(!apiKey||!c.validated||!c.validatedImage)return;
const wd=buildWardrobeDescription(c.wardrobe);if(!wd){showToast('Choisissez un vêtement','warn');return;}
document.getElementById('progress-zone').classList.add('visible');setProgress('Nouvelle tenue…',20);
try{
const prompt=`CRITICAL: Preserve EXACT same face, identity, hair, skin tone, eye color, expression, body shape, pose. Only change clothing. New outfit: ${wd}. Same ${getStudioStylePrompt(state.studioStyle)}. Full body, neutral pose.`;
const res=await fetch('https://apihub.agnes-ai.com/v1/images/generations',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:'agnes-image-v1.0',prompt,image:c.validatedImage,n:1,size:'1024x1024'})});
if(!res.ok)throw new Error('HTTP '+res.status);
setProgress('Téléchargement…',80);
const data=await res.json();const url=data.data?.[0]?.url||data.url||data.image_url;
if(!url)throw new Error('Pas d\'image');
c.generatedImage=url;c.thumbnail=await makeThumbnail(url);c.wardrobeValidated=false;c.validatedWardrobe=null;
saveChars();renderStudio();renderLibrary();
setProgress('Terminé ✓',100);setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),1000);
showToast('✓ Régénérée','success',3000);
}catch(e){document.getElementById('progress-zone').classList.remove('visible');showToast('Erreur : '+e.message,'error',4000);}
}

/* SCÈNES */
function renderScenes(){
document.getElementById('scenes-count-badge').textContent=state.scenes.length;
const container=document.getElementById('scene-cards');
if(!state.scenes.length){container.innerHTML='<div class="lib-empty"><span class="lib-empty-emoji">🎬</span><div>Aucune scène.</div></div>';return;}
container.innerHTML=state.scenes.map((s,i)=>{
const chars=(s.characterIds||[]).map(cid=>{const c=state.characters.find(x=>x.id===cid);if(!c)return null;const oid=s.outfitIds?.[cid];const o=c.savedOutfits.find(x=>x.id===oid);return{c,outfit:o};}).filter(Boolean);
const chips=chars.map(({c,outfit})=>`<div class="scene-char-chip">${c.thumbnail?`<img src="${c.thumbnail}" alt="">`:''}<span>${esc(c.name||'?')}</span>${outfit?`<span class="scene-char-outfit">· ${esc(outfit.name)}</span>`:''}</div>`).join('');
const ready=chars.every(({c})=>c.wardrobeValidated);
const dc=s.drafts.length;
const vd=s.drafts.find(d=>d.validated);
return `<div class="scene-card ${s.validated?'validated':''} ${dc?'has-drafts':''}">
<div class="scene-card-header"><div class="scene-card-title">🎬 ${esc(s.name||'Scène '+(i+1))} ${vd?'<span style="color:#6ee7a9;font-size:.7rem;">✓ IMAGE</span>':''}</div><button class="scene-card-delete" data-delete-scene="${s.id}">✕</button></div>
<div class="scene-chars">${chips||'<span style="font-size:.72rem;color:var(--ink-dim);">Aucun personnage</span>'}</div>
${s.description?`<div class="scene-card-desc"><strong>Décor :</strong> ${esc(s.description)}</div>`:''}
<div class="scene-card-desc" style="font-size:.7rem;"><strong>${esc(s.atmosphere||'cinematic')}</strong> · ${Math.round((s.numFrames||153)/24)}s ${dc?`· 📚 ${dc}`:''}</div>
<div class="scene-card-actions">
<button class="btn-gen" data-gen-img="${s.id}" ${ready?'':'disabled'}>${dc?'📚 Voir':'🎨 Générer'}</button>
<button data-edit-scene="${s.id}">✏️ Modifier</button>
<button class="btn-edit" data-edit-scene="${s.id}">${dc?'🔽 Studio':'✏️ Scénario'}</button>
</div></div>`;
}).join('');
container.querySelectorAll('[data-delete-scene]').forEach(b=>b.onclick=async()=>{const ok=await showModal({icon:'🗑️',title:'Supprimer ?',message:'Scène supprimée.',confirmText:'Supprimer',variant:'danger'});if(!ok)return;state.scenes=state.scenes.filter(x=>x.id!==b.dataset.deleteScene);saveScenes();renderScenes();showToast('Supprimée','warn');});
container.querySelectorAll('[data-edit-scene]').forEach(b=>b.onclick=()=>openSceneEditor(b.dataset.editScene));
container.querySelectorAll('[data-gen-img]').forEach(b=>b.onclick=()=>openSceneStudio(b.dataset.genImg));
}
function openSceneStudio(sid){const s=state.scenes.find(x=>x.id===sid);if(!s)return;state.openSceneImagePanel=sid;renderSceneStudio();setTimeout(()=>document.getElementById('scene-studio-container')?.scrollIntoView({behavior:'smooth',block:'start'}),100);}
function renderSceneStudio(){
let ct=document.getElementById('scene-studio-container');
if(!ct){ct=document.createElement('div');ct.id='scene-studio-container';const sc=document.getElementById('scene-cards');if(sc)sc.parentNode.insertBefore(ct,sc);}
const s=state.scenes.find(x=>x.id===state.openSceneImagePanel);if(!s){ct.innerHTML='';return;}
const d=s.drafts||[];
const vd=d.find(x=>x.validated);
const aid=s.activeDraftId||(vd?vd.id:(d[0]?.id));
const ad=d.find(x=>x.id===aid);
ct.innerHTML=`
<div class="scene-image-panel">
<div class="scene-image-header"><div><div class="scene-image-title">🎬 Studio — ${esc(s.name)}</div><div class="scene-image-subtitle">${d.length} brouillon${d.length!==1?'s':''} ${vd?'· ✓ validée':''}</div></div><button class="studio-panel-close" id="scene-studio-close">✕</button></div>
${ad?`
<div class="field-label">Brouillon ${d.indexOf(ad)+1}/${d.length}</div>
<img class="scene-image-preview" src="${ad.imageUrl}" alt="">
<div class="note" style="text-align:center;font-style:normal;">${ad.validated?'✅ <strong style="color:#6ee7a9;">Validée</strong>':'⏳ En attente'}</div>
<div class="scene-image-actions">
<button class="btn-regen-img" id="scene-regen-img-btn">🔄 Régénérer</button>
<button class="btn-validate-img" id="scene-validate-img-btn" ${ad.validated?'disabled':''}>${ad.validated?'✅ VALIDÉE':'✓ VALIDER'}</button>
</div>
${ad.validated?`<button class="btn-primary" id="scene-run-video-btn" style="margin-top:.8rem;padding:1rem;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;">🎞️ GÉNÉRER LA VIDÉO</button>`:'<div class="note warn" style="text-align:center;margin-top:.6rem;">⚠️ Validez une image</div>'}
`:`
<div class="outfit-empty">Aucun brouillon.</div>
<button class="btn-primary" id="scene-gen-first-draft" style="margin-top:.8rem;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;">🎨 Générer le premier brouillon</button>`}
${d.length?`
<div class="drafts-section">
<div class="drafts-header"><div class="drafts-title">📚 Brouillons <span class="drafts-count">${d.length}</span></div><button class="btn-secondary" id="scene-add-draft-btn" style="width:auto;padding:.4rem .7rem;font-size:.72rem;margin:0;">+ Nouveau</button></div>
<div class="drafts-grid">
${d.map((dr,i)=>`<div class="draft-card ${dr.id===aid?'selected':''} ${dr.validated?'validated':''}" data-draft-select="${dr.id}">
<img class="draft-thumb" src="${dr.imageUrl}" alt="">
<span class="draft-badge">#${i+1}</span>
${dr.validated?'<span class="draft-validated-badge">✓</span>':''}
<div class="draft-info"><div class="draft-name">Brouillon ${i+1}</div><div class="draft-time">${new Date(dr.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div></div>
<div class="draft-actions">
<button class="draft-validate" data-draft-validate="${dr.id}" ${dr.validated?'disabled':''}>${dr.validated?'✓':'Valider'}</button>
<button class="draft-delete" data-draft-delete="${dr.id}">✕</button>
</div></div>`).join('')}
</div></div>`:''}
</div>`;
document.getElementById('scene-studio-close').onclick=()=>{state.openSceneImagePanel=null;ct.innerHTML='';};
['scene-regen-img-btn','scene-add-draft-btn','scene-gen-first-draft'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>generateSceneDraft(s);});
const vb=document.getElementById('scene-validate-img-btn');if(vb)vb.onclick=()=>validateSceneDraft(s,aid);
const rb=document.getElementById('scene-run-video-btn');if(rb)rb.onclick=()=>runSceneVideo(s,ad);
ct.querySelectorAll('[data-draft-select]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;s.activeDraftId=el.dataset.draftSelect;saveScenes();renderSceneStudio();});
ct.querySelectorAll('[data-draft-validate]').forEach(b=>b.onclick=e=>{e.stopPropagation();validateSceneDraft(s,b.dataset.draftValidate);});
ct.querySelectorAll('[data-draft-delete]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const ok=await showModal({icon:'🗑️',title:'Supprimer ?',message:'Brouillon supprimé.',confirmText:'Supprimer',variant:'danger'});if(!ok)return;s.drafts=s.drafts.filter(x=>x.id!==b.dataset.draftDelete);if(s.activeDraftId===b.dataset.draftDelete)s.activeDraftId=s.drafts[0]?.id;saveScenes();renderSceneStudio();});
}
async function generateSceneDraft(s){
const apiKey=getApiKey();if(!apiKey){showToast('Clé API requise','error');return;}
const chars=s.characterIds.map(cid=>{const c=state.characters.find(x=>x.id===cid);if(!c)return null;const oid=s.outfitIds?.[cid];const o=c.savedOutfits.find(x=>x.id===oid);return{c,outfit:o};}).filter(Boolean);
if(!chars.length){showToast('Aucun personnage','warn');return;}
const nr=chars.filter(({c})=>!c.wardrobeValidated);if(nr.length){showToast('Tenues non validées','error',4000);return;}
document.getElementById('progress-zone').classList.add('visible');setProgress('Brouillon…',20);
try{
const prompt=buildScenePrompt(s,chars);
const body={model:'agnes-image-v1.0',prompt,n:1,size:'1024x1024'};
const f=chars[0];if(f&&f.c.validatedImage){body.image=f.c.validatedImage;body.prompt+=' Match character design.';}
setProgress('Génération…',50);
const res=await fetch('https://apihub.agnes-ai.com/v1/images/generations',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
if(!res.ok)throw new Error('HTTP '+res.status);
setProgress('Téléchargement…',80);
const data=await res.json();const url=data.data?.[0]?.url||data.url||data.image_url;
if(!url)throw new Error('Pas d\'image');
const draft={id:'draft_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),imageUrl:url,settings:{style:state.studioStyle},validated:false,createdAt:Date.now()};
if(!s.drafts)s.drafts=[];
s.drafts.push(draft);s.activeDraftId=draft.id;
saveScenes();renderSceneStudio();renderScenes();
setProgress('Brouillon créé ✓',100);setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),1000);
showToast('📚 Brouillon créé','success',3000);
}catch(e){document.getElementById('progress-zone').classList.remove('visible');showToast('Erreur : '+e.message,'error',4000);}
}
async function validateSceneDraft(s,id){
const d=s.drafts.find(x=>x.id===id);if(!d)return;
const ok=await showModal({icon:'🎬',title:'Valider ?',message:'Base pour la vidéo.',confirmText:'✓ Valider'});
if(!ok)return;
s.drafts.forEach(x=>x.validated=false);d.validated=true;s.activeDraftId=d.id;
saveScenes();renderSceneStudio();renderScenes();showToast('✅ Validée','success',3000);
}
async function runSceneVideo(s,d){
if(!d||!d.validated)return;
const apiKey=getApiKey();if(!apiKey)return;
const chars=s.characterIds.map(cid=>{const c=state.characters.find(x=>x.id===cid);if(!c)return null;const oid=s.outfitIds?.[cid];const o=c.savedOutfits.find(x=>x.id===oid);return{c,outfit:o};}).filter(Boolean);
state.isRunning=true;state.stopRequested=false;
document.getElementById('process-btn').disabled=true;document.getElementById('stop-btn').classList.add('visible');
document.getElementById('progress-zone').classList.add('visible');document.getElementById('output-zone').classList.remove('visible');
try{
setProgress('Vidéo…',30);
const vid=await generateVideoFromScene(d.imageUrl,s,chars);
setProgress('Vidéo en cours…',50);
const url=await pollVideo(vid,i=>setProgress('Vidéo… '+Math.round(50+i*.4)+'%',Math.min(99,50+i*.4)));
setProgress('Téléchargement…',95);
let blob=null;try{const r=await fetch(url);blob=await r.blob();}catch(e){}
if(blob)finalizeOutput(blob,'.mp4');
else{showToast('Vidéo prête (URL externe)','success');}
setProgress('Terminé ✓',100);setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),2000);
}catch(e){console.error(e);showToast('Erreur : '+e.message,'error',5000);}
state.isRunning=false;document.getElementById('process-btn').disabled=false;document.getElementById('stop-btn').classList.remove('visible');
}
function openSceneEditor(sid){
if(!state.characters.length){showToast('Créez des personnages','warn');return;}
let s=sid?state.scenes.find(x=>x.id===sid):null;
const isNew=!s;
if(isNew)s={id:'scene_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),name:'Scène '+(state.scenes.length+1),characterIds:[],outfitIds:{},description:'',action:'',atmosphere:'cinematic',camera:'slow dolly in, camera gliding forward almost imperceptibly',numFrames:153,validated:false,drafts:[],createdAt:Date.now()};
const sel=state.characters.map(c=>{const sn=s.characterIds.includes(c.id);const r=c.wardrobeValidated;
return `<div class="scene-char-option ${sn?'selected':''} ${r?'':'disabled'}" data-scene-char="${c.id}">
${c.thumbnail?`<img src="${c.thumbnail}" alt="">`:'<div style="width:100%;aspect-ratio:1;background:#2a2a35;border-radius:6px;margin-bottom:.3rem;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🎭</div>'}
<div class="scene-char-name">${esc(c.name||'?')}</div>
${r?'<span class="scene-char-ready">✓</span>':'<span class="scene-char-blocked">!</span>'}
${sn&&c.savedOutfits.length?`<select class="scene-char-outfit-select" data-outfit-for="${c.id}" onclick="event.stopPropagation();"><option value="">Tenue actuelle</option>${c.savedOutfits.map(o=>`<option value="${o.id}" ${s.outfitIds[c.id]===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`:''}
</div>`;}).join('');
const html=`
<div class="scene-image-panel" style="border-color:var(--purple);" id="scene-editor-panel">
<div class="scene-image-header"><div><div class="scene-image-title" style="color:#e9d5ff;">${isNew?'🎬 Nouvelle scène':'✏️ Édition'}</div></div><button class="studio-panel-close" id="scene-editor-close">✕</button></div>
<div class="field-row"><label class="field-label">Nom</label><input type="text" id="scene-name-input" value="${esc(s.name)}"></div>
<div class="field-row"><label class="field-label">🎭 Personnages (${s.characterIds.length})</label><div class="scene-char-select">${sel}</div></div>
<div class="field-row"><label class="field-label">🏞️ Décor</label><textarea id="scene-desc-input">${esc(s.description)}</textarea></div>
<div class="field-row"><label class="field-label">🎯 Action</label><textarea id="scene-action-input">${esc(s.action)}</textarea></div>
<div class="field-row"><label class="field-label">🌈 Atmosphère</label><select id="scene-atm-input">${['cinematic','joyful','mysterious','romantic','epic','cozy','dramatic','fantasy','scifi','retro','cyberpunk','nature'].map(a=>`<option value="${a}" ${s.atmosphere===a?'selected':''}>${a}</option>`).join('')}</select></div>
<div class="field-row"><label class="field-label">📷 Caméra</label><select id="scene-cam-input">${['slow dolly in, camera gliding forward almost imperceptibly','slow dolly out, revealing more of the environment','static locked-off frame, subjects move within fixed borders','handheld, subtle tremor, camera breathing with the subjects','slow pan following the subjects\' movement','smooth orbital movement around the subjects','low angle looking up at the subjects, powerful framing'].map(c=>`<option value="${c}" ${s.camera===c?'selected':''}>${c.split(',')[0]}</option>`).join('')}</select></div>
<div class="field-row"><label class="field-label">⏱️ Durée</label><select id="scene-dur-input"><option value="121" ${s.numFrames===121?'selected':''}>5s</option><option value="153" ${s.numFrames===153?'selected':''}>6,4s</option><option value="241" ${s.numFrames===241?'selected':''}>10s</option></select></div>
<button class="btn-validate-big" id="scene-save-btn">✓ VALIDER LA SCÈNE<span class="btn-hint">${isNew?'Créer':'Enregistrer'}</span></button>
</div>`;
const temp=document.createElement('div');temp.innerHTML=html;
const panel=temp.firstElementChild;
const sc=document.getElementById('scenes-section');
sc.parentNode.insertBefore(panel,sc);
panel.scrollIntoView({behavior:'smooth',block:'start'});
panel.querySelector('#scene-editor-close').onclick=()=>panel.remove();
panel.querySelectorAll('[data-scene-char]').forEach(o=>{if(o.classList.contains('disabled'))return;o.onclick=()=>{const cid=o.dataset.sceneChar;const i=s.characterIds.indexOf(cid);if(i>=0)s.characterIds.splice(i,1);else s.characterIds.push(cid);panel.querySelector('#scene-editor-close').click();setTimeout(()=>{const ex=state.scenes.find(x=>x.id===s.id);if(!ex)state.scenes.push(s);openSceneEditor(s.id);},50);};});
panel.querySelectorAll('[data-outfit-for]').forEach(se=>{se.onchange=e=>{const cid=se.dataset.outfitFor;if(e.target.value)s.outfitIds[cid]=e.target.value;else delete s.outfitIds[cid];};se.onclick=e=>e.stopPropagation();});
panel.querySelector('#scene-save-btn').onclick=async()=>{
s.name=panel.querySelector('#scene-name-input').value.trim()||'Scène';
s.description=panel.querySelector('#scene-desc-input').value.trim();
s.action=panel.querySelector('#scene-action-input').value.trim();
s.atmosphere=panel.querySelector('#scene-atm-input').value;
s.camera=panel.querySelector('#scene-cam-input').value;
s.numFrames=parseInt(panel.querySelector('#scene-dur-input').value,10);
s.validated=true;
if(!s.characterIds.length){showToast('Sélectionnez un personnage','warn');return;}
const ok=await showModal({icon:'🎬',title:'Valider ?',message:`<strong>${esc(s.name)}</strong>`,confirmText:'✓ Valider'});
if(!ok)return;
if(isNew)state.scenes.push(s);
else{const i=state.scenes.findIndex(x=>x.id===s.id);if(i>=0)state.scenes[i]=s;}
saveScenes();renderScenes();panel.remove();showToast('🎬 Validée','success');
setTimeout(()=>openSceneStudio(s.id),300);
};
}
function buildScenePrompt(s,chars){
const sd=getStudioStylePrompt(state.studioStyle);
const cd=chars.map(({c,outfit},i)=>{const p=[`Character ${i+1}: ${c.name||'unnamed'}`];if(c.description)p.push(c.description);if(c.appearance?.hair)p.push(`hair: ${c.appearance.hair}`);if(c.appearance?.eyes)p.push(`eyes: ${c.appearance.eyes}`);const aw=outfit?outfit.wardrobe:(c.wardrobeValidated?c.validatedWardrobe:c.wardrobe);const wd=buildWardrobeDescription(aw);if(wd)p.push(`wearing ${wd}`);return p.join(', ');}).join(' | ');
let p=`Cartoon scene in ${sd}. Characters: ${cd}. `;
if(s.description)p+=`Scene: ${s.description}. `;
p+=`Atmosphere: ${s.atmosphere}. `;
if(s.action)p+=`Action: ${s.action}. `;
p+=`Camera: ${s.camera}. Cinematic framing.`;
return p;
}
async function generateVideoFromScene(imgUrl,s,chars){
const apiKey=getApiKey();
const prompt=buildScenePrompt(s,chars)+` Animate as cartoon.`;
const res=await fetch('https://apihub.agnes-ai.com/v1/videos',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:'agnes-video-v2.0',prompt,image:imgUrl,num_frames:s.numFrames||153,frame_rate:24})});
if(!res.ok)throw new Error('HTTP '+res.status);
const d=await res.json();const vid=d.video_id||d.id||d.task_id;
if(!vid)throw new Error('Pas d\'ID');
return vid;
}
async function pollVideo(id,onProgress){
const apiKey=getApiKey();
for(let i=0;i<150;i++){
if(state.stopRequested)throw new Error('Arrêt');
await sleep(6000);onProgress(i);
const r=await fetch('https://apihub.agnes-ai.com/agnesapi?video_id='+encodeURIComponent(id)+'&model_name=agnes-video-v2.0',{headers:{'Authorization':'Bearer '+apiKey}});
const d=await r.json();const st=d.status||'unknown';
if(st==='completed'||st==='succeeded'||st==='done'){const u=(d.metadata&&d.metadata.url)||d.url||(d.output&&d.output.url);if(!u)throw new Error('Pas d\'URL');return u;}
if(st==='failed'||st==='error'||st==='cancelled')throw new Error('Échec');
}
throw new Error('Timeout');
}

/* CANVAS PIPELINE */
const fc=document.getElementById('filter-canvas'),fx=fc.getContext('2d',{willReadFrequently:true});
const CM=['kenburns','zoomin','zoomout','pan','shake','static'];
function pickCam(){return CM[Math.floor(Math.random()*CM.length)];}
function camT(m,t,i){const a=i;let s=1,ox=0,oy=0;switch(m){case 'zoomin':s=1+.15*a*t;break;case 'zoomout':s=1+.15*a*(1-t);break;case 'pan':s=1+.08*a;ox=(t-.5)*.18*a*(1/s);break;case 'kenburns':s=1+.12*a*t;ox=(t-.5)*.1*a;oy=(t-.5)*.1*a;break;case 'shake':s=1+.05*a;ox=Math.sin(t*75)*.008*a;oy=Math.cos(t*98)*.008*a;break;}return{scale:s,offsetX:ox,offsetY:oy};}
function drawC(source,ctx,W,H,strength,cam){
const FW=Math.round(W*.85),FH=Math.round(FW*H/W);
if(fc.width!==FW||fc.height!==FH){fc.width=FW;fc.height=FH;}
fx.drawImage(source,0,0,FW,FH);
const img=fx.getImageData(0,0,FW,FH),d=img.data;
const g=new Uint8ClampedArray(FW*FH);
for(let i=0,j=0;i<d.length;i+=4,j++)g[j]=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)|0;
const ed=new Uint8ClampedArray(FW*FH),th=20+(1-strength)*60;
for(let y=1;y<FH-1;y++)for(let x=1;x<FW-1;x++){const i=y*FW+x;const gx=-g[i-FW-1]-2*g[i-1]-g[i+FW-1]+g[i-FW+1]+2*g[i+1]+g[i+FW+1];const gy=-g[i-FW-1]-2*g[i-FW]-g[i-FW+1]+g[i+FW-1]+2*g[i+FW]+g[i+FW+1];ed[i]=(gx*gx+gy*gy)>th*th?255:0;}
for(let i=0,j=0;i<d.length;i+=4,j++){if(ed[j]===255){d[i]=10;d[i+1]=10;d[i+2]=15;}}
fx.putImageData(img,0,0);
ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
ctx.translate(W/2,H/2);ctx.scale(cam.scale,cam.scale);ctx.translate(-W/2+cam.offsetX*W,-H/2+cam.offsetY*H);
ctx.drawImage(fc,0,0,W,H);ctx.restore();
}
async function runCanvas(){
setProgress('Préparation…',0);
const q=document.getElementById('output-quality')?.value||'1080';let oW,oH;
if(q==='source'){oW=state.videoWidth;oH=state.videoHeight;}else{oH=parseInt(q,10);oW=Math.round(oH*state.videoWidth/state.videoHeight);}
oW-=oW%2;oH-=oH%2;
const work=document.getElementById('work-canvas');work.width=oW;work.height=oH;
const ctx=work.getContext('2d'),src=document.getElementById('source-video');
const cs=work.captureStream(30),fs=new MediaStream();fs.addTrack(cs.getVideoTracks()[0]);
const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
const rec=new MediaRecorder(fs,{mimeType:mime,videoBitsPerSecond:5000000});
state.recorder=rec;const chunks=[];rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};rec.start(500);
src.currentTime=0;
await new Promise(r=>{const h=()=>{src.removeEventListener('seeked',h);r();};src.addEventListener('seeked',h);});
return new Promise(res=>{
let si=0,ss=state.detectedScenes[0].start,se=state.detectedScenes[0].end;
const loop=()=>{
if(state.stopRequested){fin();return;}
const t=src.currentTime;
if(t>=se&&si<state.detectedScenes.length-1){si++;ss=state.detectedScenes[si].start;se=state.detectedScenes[si].end;}
setProgress(`Rendu ${si+1}/${state.detectedScenes.length}`,Math.min(99,5+(t/state.videoDuration)*93));
const sD=se-ss||1,lT=Math.max(0,Math.min(1,(t-ss)/sD));
const cam=camT(state.detectedScenes[si].move,lT,.65);
try{drawC(src,ctx,oW,oH,.65,cam);}catch(e){}
if(src.ended||t>=state.videoDuration-.05){fin();return;}
requestAnimationFrame(loop);
};
const fin=()=>{try{src.pause();}catch(e){}try{if(rec.state!=='inactive')rec.stop();}catch(e){}};
rec.onstop=()=>{finalizeOutput(new Blob(chunks,{type:mime}),'.webm');res();};
src.muted=true;src.play().then(()=>requestAnimationFrame(loop));
});
}

/* UTIL */
function setProgress(s,p){document.getElementById('progress-stage').textContent=s;document.getElementById('progress-percent').textContent=Math.round(p)+'%';document.getElementById('progress-fill').style.width=p+'%';}
function fmtDur(s){if(!isFinite(s))return'∞';const m=Math.floor(s/60),x=Math.floor(s%60);return `${m}:${x.toString().padStart(2,'0')}`;}
function ts(){const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());}
function stopProcessing(){if(!state.isRunning)return;state.stopRequested=true;try{document.getElementById('source-video').pause();}catch(e){}try{if(state.recorder&&state.recorder.state!=='inactive')state.recorder.stop();}catch(e){}showToast('Arrêt…','warn');}
function finalizeOutput(blob,ext){
state.outputBlob=blob;if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);
state.outputUrl=URL.createObjectURL(blob);
document.getElementById('output-video').src=state.outputUrl;
const dl=document.getElementById('download-webm');dl.href=state.outputUrl;dl.download='cartoon-'+ts()+ext;dl.textContent='⬇️ Télécharger';
document.getElementById('output-zone').classList.add('visible');
if(window.showSaveFilePicker)document.getElementById('save-fs-btn').style.display='flex';
if(document.getElementById('hashtags-auto').checked){const t=generateHashtags();renderHashtags(t);showToast('🎉 + '+t.length+' hashtags','success',3500);}
else showToast('🎉 Vidéo prête','success',3000);
setTimeout(()=>document.getElementById('output-zone').scrollIntoView({behavior:'smooth',block:'start'}),300);
}

/* FFMPEG */
function loadScript(u){return new Promise((r,j)=>{const s=document.createElement('script');s.src=u;s.onload=r;s.onerror=j;document.head.appendChild(s);});}
async function ensureFF(){if(state.ffmpegLoaded)return state.ffmpeg;const st=document.getElementById('ffmpeg-status');st.classList.remove('hidden','ready','error');st.classList.add('loading');st.innerHTML='<span>Chargement…</span><span class="spinner"></span>';try{if(!window.FFmpegWASM)await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');if(!window.FFmpegUtil)await loadScript('https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js');const ff=new FFmpegWASM.FFmpeg();ff.on('progress',({progress})=>{st.innerHTML='<span>'+Math.round(progress*100)+'%</span><span class="spinner"></span>';});await ff.load({coreURL:'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',wasmURL:'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'});state.ffmpeg=ff;state.ffmpegLoaded=true;st.classList.remove('loading');st.classList.add('ready');st.innerHTML='<span>✓ prêt</span>';return ff;}catch(e){st.classList.remove('loading');st.classList.add('error');throw e;}}
async function convertMp4(){if(!state.outputBlob){showToast('Aucune vidéo','error');return;}const st=document.getElementById('ffmpeg-status');try{const ff=await ensureFF();st.classList.add('loading');const {fetchFile}=FFmpegUtil;await ff.writeFile('i.webm',await fetchFile(state.outputBlob));await ff.exec(['-i','i.webm','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','o.mp4']);const data=await ff.readFile('o.mp4');const b=new Blob([data.buffer],{type:'video/mp4'});const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='cartoon-'+ts()+'.mp4';document.body.appendChild(a);a.click();document.body.removeChild(a);st.classList.remove('loading');st.classList.add('ready');showToast('MP4 ✓','success');}catch(e){showToast('Erreur MP4','error',4000);}}

/* VIDÉO SOURCE */
async function loadVideo(){const url=document.getElementById('video-url').value.trim();if(!url){showToast('Collez un lien','error');return;}loadVideoFromUrl(url);}
async function loadVideoFromUrl(url){const p=document.getElementById('preview-video');p.src=url;document.getElementById('source-video').src=url;showToast('Chargement…','warn',1500);p.onloadedmetadata=()=>{state.videoLoaded=true;state.videoDuration=p.duration;state.videoWidth=p.videoWidth;state.videoHeight=p.videoHeight;state.videoUrl=url;document.getElementById('preview-section').classList.remove('hidden');document.getElementById('preview-section').classList.add('open');document.getElementById('video-stats').innerHTML=`<div class="stat-box"><span class="stat-val">${fmtDur(state.videoDuration)}</span><span class="stat-lab">Durée</span></div><div class="stat-box"><span class="stat-val">${state.videoWidth}×${state.videoHeight}</span><span class="stat-lab">Résolution</span></div>`;document.getElementById('process-btn').disabled=false;showToast('Chargée ✓','success');};p.onerror=()=>showToast('Erreur','error',4000);}
async function analyzeScenes(){if(!state.videoLoaded)return;const w=document.getElementById('work-canvas'),wx=w.getContext('2d',{willReadFrequently:true});w.width=64;w.height=36;const v=document.createElement('video');v.src=state.videoUrl;v.muted=true;v.crossOrigin='anonymous';try{await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j;});}catch(e){return;}const dur=v.duration,cuts=[0];document.getElementById('progress-zone').classList.add('visible');setProgress('Analyse…',0);let lh=null;const si=.5;let c=0,t=Math.floor(dur/si);for(let x=0;x<dur;x+=si){if(state.stopRequested)break;v.currentTime=x;await new Promise(r=>{const h=()=>{v.removeEventListener('seeked',h);r();};v.addEventListener('seeked',h);});wx.drawImage(v,0,0,64,36);const d=wx.getImageData(0,0,64,36).data,h=new Float32Array(32);for(let i=0;i<d.length;i+=4){const l=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)|0;h[Math.floor(l/8)]++;}for(let i=0;i<32;i++)h[i]/=2304;if(lh){let diff=0;for(let i=0;i<32;i++)diff+=Math.abs(h[i]-lh[i]);if(diff/2>.25)cuts.push(x);}lh=h;c++;setProgress('Analyse…',c/t*100);}cuts.push(dur);state.detectedScenes=[];for(let i=0;i<cuts.length-1;i++){const s=cuts[i],e=cuts[i+1];if(e-s<.3)continue;state.detectedScenes.push({start:s,end:e,duration:e-s,move:pickCam()});}setProgress('Terminé',100);setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),800);const list=document.getElementById('scenes-list');list.classList.remove('hidden');list.innerHTML=state.detectedScenes.map((s,i)=>`<div class="scene-item"><div class="scene-num">${i+1}</div><div class="scene-info"><div class="scene-time">${fmtDur(s.start)} → ${fmtDur(s.end)}</div><div class="scene-move">📷 ${s.move}</div></div></div>`).join('');showToast(`${state.detectedScenes.length} scènes`,'success');}
async function processVideo(){if(state.isRunning)return;if(state.mode==='studio'){showToast('Utilisez les scènes','warn');return;}if(!state.videoLoaded){showToast('Chargez une vidéo','error');return;}if(!state.detectedScenes.length){await analyzeScenes();if(!state.detectedScenes.length)return;}state.isRunning=true;state.stopRequested=false;document.getElementById('process-btn').disabled=true;document.getElementById('stop-btn').classList.add('visible');document.getElementById('progress-zone').classList.add('visible');document.getElementById('output-zone').classList.remove('visible');try{await runCanvas();}catch(e){showToast('Erreur : '+e.message,'error',4000);}state.isRunning=false;document.getElementById('process-btn').disabled=false;document.getElementById('stop-btn').classList.remove('visible');setTimeout(()=>document.getElementById('progress-zone').classList.remove('visible'),2000);}

/* INIT */
function renderStyleChips(){const el=document.getElementById('studio-style-chips');el.innerHTML=STUDIO_STYLES.map(s=>`<span data-style="${s.id}" style="padding:.35rem .7rem;border-radius:14px;border:1px solid var(--border);background:var(--panel-2);font-size:.72rem;cursor:pointer;${s.id===state.studioStyle?'background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;border-color:#a855f7;font-weight:700;':''}">${s.emoji} ${s.name}</span>`).join('');el.querySelectorAll('[data-style]').forEach(c=>c.onclick=()=>{state.studioStyle=c.dataset.style;renderStyleChips();});}

(function init(){
renderStyleChips();renderLibrary();renderScenes();
document.querySelectorAll('[data-toggle]').forEach(h=>h.onclick=()=>document.getElementById(h.dataset.toggle).classList.toggle('open'));
const bind=(id,lid,s='')=>{const e=document.getElementById(id),l=document.getElementById(lid);if(e&&l)e.oninput=()=>{l.textContent=e.value+s;};};
bind('hashtags-count','hashtags-count-val','');
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
state.mode=b.dataset.mode;
document.querySelectorAll('.mode-btn').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.mode));
const pb=document.getElementById('process-btn');
if(state.mode==='studio'){pb.textContent='🎬 (utilisez les scènes)';pb.disabled=true;}
else{pb.textContent='🎬 Lancer';pb.disabled=!state.videoLoaded;}
});
document.getElementById('add-char-btn').onclick=createNewCharacter;
document.getElementById('add-scene-btn').onclick=()=>openSceneEditor(null);
document.getElementById('add-multi-scene-btn').onclick=openMultiScene;
document.getElementById('load-video-btn').onclick=loadVideo;
document.getElementById('local-video').onchange=e=>{const f=e.target.files[0];if(!f)return;document.getElementById('local-video-name').textContent=f.name;loadVideoFromUrl(URL.createObjectURL(f));};
document.getElementById('analyze-btn').onclick=analyzeScenes;
document.getElementById('process-btn').onclick=processVideo;
document.getElementById('stop-btn').onclick=stopProcessing;
document.getElementById('convert-mp4-btn').onclick=convertMp4;
document.getElementById('copy-hashtags-btn').onclick=copyAllHashtags;
document.getElementById('download-hashtags-btn').onclick=downloadHashtagsTxt;
document.getElementById('vr-exit-btn').onclick=exitVR;
document.getElementById('save-fs-btn').onclick=saveToFolder;
['hashtags-platform','hashtags-lang','hashtags-count','hashtags-custom'].forEach(id=>{const el=document.getElementById(id);if(el)el.oninput=()=>{if(document.getElementById('hashtag-zone').classList.contains('visible'))renderHashtags(generateHashtags());};});
console.log('[PRO MAX] Prêt — '+state.characters.length+' perso, '+state.scenes.length+' scènes');
})();
