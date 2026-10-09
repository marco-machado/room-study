import './style.css';
import { createIcons, ArrowUpRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Box, ChevronDown, Check, Expand, RotateCcw, Settings2, X, Sun, Moon, Move, Info, DoorOpen, Keyboard, MousePointer2, Layers, Maximize2, Minimize2 } from 'lucide';
import { RoomViewer, viewpoints, type ViewName } from './viewer';

const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`
  <div id="viewport"></div>
  <div class="vignette" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="./" aria-label="Room Study home"><span class="brand-icon"><i data-lucide="box"></i></span><span>room<span class="brand-light">study</span><span class="brand-dot">.</span></span></a>
    <span class="project-label">A SPACE, RECONSIDERED</span>
    <div class="top-actions"><span class="engine"><span></span> WebGPU</span><span class="divider"></span><button class="icon-button" id="info-button" aria-label="About this reconstruction" title="About this reconstruction"><i data-lucide="info"></i></button><button class="icon-button" id="fullscreen" aria-label="Enter fullscreen" title="Enter fullscreen"><i data-lucide="expand"></i></button></div>
  </header>
  <div class="view-marker"><span id="view-number">01</span><span class="marker-line"></span><span id="view-name">The entrance</span></div>
  <div class="scene-actions"><button class="icon-button glass" id="settings-button" aria-label="Scene settings" aria-expanded="false" title="Scene settings"><i data-lucide="settings-2"></i></button><button class="icon-button glass" id="reset-button" aria-label="Reset view" title="Reset view"><i data-lucide="rotate-ccw"></i></button></div>
  <section id="settings-panel" class="floating-panel" aria-label="Scene settings" hidden>
    <div class="panel-heading"><h2>Make yourself at home</h2><button class="icon-button small" id="close-settings" aria-label="Close settings"><i data-lucide="x"></i></button></div>
    <div class="setting-label"><span>Natural light</span><span id="light-value">100%</span></div>
    <input id="light-range" type="range" min="0" max="100" value="100" aria-label="Natural light intensity" />
    <div class="range-labels"><span>Evening</span><span>Daylight</span></div>
    <div class="setting-row"><span><i data-lucide="door-open"></i> Entrance door</span><button id="door-toggle" class="switch" role="switch" aria-checked="true" aria-label="Entrance door open"><span></span></button></div>
    <div class="panel-note">Same room. A different atmosphere.</div>
  </section>
  <aside id="about-panel" class="floating-panel about-panel" hidden aria-label="About the space">
    <div class="panel-heading"><h2>A study of your space</h2><button class="icon-button small" id="close-about" aria-label="Close about panel"><i data-lucide="x"></i></button></div>
    <p>The familiar architecture, with room to breathe. Recreated from your photographs, with furniture and personal belongings removed.</p>
    <dl><div><dt>Walls</dt><dd>Warm cream plaster</dd></div><div><dt>Floor</dt><dd>Diagonal ceramic tile</dd></div><div><dt>Details</dt><dd>Dark timber · plaster cornice</dd></div></dl>
    <p class="about-footnote">Procedural geometry & materials · Three.js / WebGPU<br>Proportions are estimated from the photographs.</p>
  </aside>
  <div class="bottom-info"><h1>An empty space.<br>A new perspective.</h1><p>All the character. None of the clutter.</p></div>
  <aside class="floorplan" aria-label="Room orientation map">
    <div class="map-heading"><span>YOU ARE HERE</span><button id="plan-expand" class="map-expand" aria-label="Open floor plan" title="Open floor plan"><i data-lucide="maximize-2"></i></button></div>
    <svg viewBox="0 0 164 168" aria-label="Plan of the entry, living room and kitchen">
      <path class="plan-floor" d="M24 30H94V153H24Z M94 46H148V101H94Z M94 116H120V145H94Z M24 6H94V30H24Z"/>
      <g class="plan-wall"><path d="M24 30V153H28 M64 153H73 M91 153H94V145 M94 116V101 M94 46V30H91 M94 101H148V46H94 M94 116H120V145H94 M24 30V6H94V30"/><path d="M28 153H64" class="plan-window"/><path d="M24 30H69" class="plan-counter"/><path d="M91 153L85 140" class="plan-door"/></g>
      <text x="59" y="92">MAIN ROOM</text><text x="121" y="75">LIVING</text><text x="59" y="19">KITCHEN</text>
      <g id="map-camera"><path d="M0 0L-9 -17Q0 -22 9 -17Z" fill="#987453" opacity=".18"/><circle r="4" fill="#8d6b4f" stroke="#faf8f4" stroke-width="2"/></g>
    </svg>
    <span class="map-caption">Approximate layout</span>
  </aside>
  <nav class="toolbar" aria-label="Room controls">
    <div class="view-tabs" role="group" aria-label="Viewpoints"><button class="view-tab active" data-view="entry"><span class="tab-number">01</span> Entrance</button><button class="view-tab" data-view="living"><span class="tab-number">02</span> Living</button><button class="view-tab" data-view="kitchen"><span class="tab-number">03</span> Kitchen</button></div>
    <span class="toolbar-divider"></span>
    <button id="plan-button" class="tool-button" aria-label="Toggle floor plan" aria-pressed="false"><i data-lucide="layers"></i><span>Floor plan</span></button>
    <span class="toolbar-divider"></span>
    <button id="light-button" class="tool-button light-button" aria-label="Change lighting"><i data-lucide="sun"></i><span id="light-name">Daylight</span><i data-lucide="chevron-down" class="chevron"></i></button>
  </nav>
  <div class="navigation-hint"><span><i data-lucide="mouse-pointer-2"></i> Drag to look</span><span class="hint-dot">·</span><span><i data-lucide="move"></i> WASD to move</span><span class="hint-dot">·</span><span>Scroll to walk</span></div>
  <div class="mobile-movement" aria-label="Walk controls"><button data-move="forward" aria-label="Move forward"><i data-lucide="arrow-up"></i></button><div><button data-move="left" aria-label="Move left"><i data-lucide="arrow-left"></i></button><button data-move="back" aria-label="Move backward"><i data-lucide="arrow-down"></i></button><button data-move="right" aria-label="Move right"><i data-lucide="arrow-right"></i></button></div></div>
  <div id="loading" class="loading-screen"><span class="loading-mark"><i data-lucide="box"></i></span><h2>A little room to breathe.</h2><p id="loading-message">Building your space<span class="loading-dots"></span></p><div class="loading-line"><span></span></div></div>
  <div id="toast" role="status" aria-live="polite"></div>
`;

const icons={ArrowUpRight,ArrowUp,ArrowDown,ArrowLeft,ArrowRight,Box,ChevronDown,Check,Expand,RotateCcw,Settings2,X,Sun,Moon,Move,Info,DoorOpen,Keyboard,MousePointer2,Layers,Maximize2,Minimize2};
const updateIcons=()=>createIcons({icons,attrs:{'stroke-width':1.5}});
updateIcons();
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const viewer=new RoomViewer($('#viewport'));
(window as unknown as {roomViewer:RoomViewer}).roomViewer=viewer;
let doorOpen=true;
let light=100;
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string) {$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}
function closePanels() {$('#settings-panel').hidden=true;$('#about-panel').hidden=true;$('#settings-button').setAttribute('aria-expanded','false');}
function selectView(view:ViewName) {
  viewer.setView(view);
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
  $('#view-number').textContent=viewpoints[view].number;$('#view-name').textContent=viewpoints[view].title;
  $('#plan-button').setAttribute('aria-pressed','false');$('#plan-button').classList.remove('selected');
  document.body.classList.remove('plan-mode');closePanels();
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view as ViewName)));
function togglePlan() {
  if(viewer.mode==='plan'){selectView(viewer.activeView);return;}
  viewer.setPlan();$('#plan-button').setAttribute('aria-pressed','true');$('#plan-button').classList.add('selected');
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  $('#view-number').textContent='04';$('#view-name').textContent='The full picture';document.body.classList.add('plan-mode');closePanels();
  toast('Drag to orbit · Scroll to zoom');
}
$('#plan-button').addEventListener('click',togglePlan);$('#plan-expand').addEventListener('click',togglePlan);
$('#reset-button').addEventListener('click',()=>{selectView(viewer.activeView);toast('Back to your starting view');});
function toggleSettings() {const open=$('#settings-panel').hidden;closePanels();$('#settings-panel').hidden=!open;$('#settings-button').setAttribute('aria-expanded',String(open));}
$('#settings-button').addEventListener('click',toggleSettings);$('#close-settings').addEventListener('click',closePanels);
$('#info-button').addEventListener('click',()=>{const open=$('#about-panel').hidden;closePanels();$('#about-panel').hidden=!open;});$('#close-about').addEventListener('click',closePanels);
function updateLight(value:number) {
  light=value;viewer.setLight(value);$('#light-value').textContent=`${value}%`;
  $('#light-name').textContent=value>65?'Daylight':value>30?'Late afternoon':'Evening';
  $<HTMLInputElement>('#light-range').value=String(value);
}
$('#light-range').addEventListener('input',e=>updateLight(Number((e.target as HTMLInputElement).value)));
$('#light-button').addEventListener('click',()=>{updateLight(light>65?40:light>30?10:100);toast(light>65?'Soft natural daylight':light>30?'A warmer afternoon':'Warm evening light');});
$('#door-toggle').addEventListener('click',()=>{doorOpen=!doorOpen;viewer.room.setDoor(doorOpen);$('#door-toggle').setAttribute('aria-checked',String(doorOpen));$('#door-toggle').setAttribute('aria-label',`Entrance door ${doorOpen?'open':'closed'}`);});
$('#fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{toast('Fullscreen is unavailable in this preview');}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanels();if(e.key.toLowerCase()==='r'&&!(e.target as HTMLElement).matches('input'))selectView(viewer.activeView);});
viewer.onMove=(x,z,yaw)=>{
  // Main room front (z=-3.25) appears at the bottom of the orientation map.
  const px=24+(x+1.9)/3.8*70,py=153-(z+3.25)/6.5*123;
  $('#map-camera').setAttribute('transform',`translate(${px},${py}) rotate(${180-yaw*180/Math.PI})`);
};
viewer.onInteract=()=>{document.body.classList.add('has-interacted');closePanels();};
let moveInterval:ReturnType<typeof setInterval>|undefined;
document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);const direction=button.dataset.move;const action=()=>viewer.move(direction==='left'?-0.055:direction==='right'?0.055:0,direction==='forward'?0.055:direction==='back'?-0.055:0);action();clearInterval(moveInterval);moveInterval=setInterval(action,35);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>clearInterval(moveInterval));
});
viewer.init().then(()=>{
  $('#loading').classList.add('loaded');document.body.classList.add('ready');
  setTimeout(()=>$('#loading').hidden=true,750);
  (window as unknown as {roomViewer:RoomViewer}).roomViewer=viewer;
}).catch((error:Error)=>{
  console.error(error);$('#loading').classList.add('error');$('#loading h2').textContent='This space needs WebGPU.';
  $('#loading-message').textContent=error.message;
  $('.loading-line').hidden=true;
  const retry=document.createElement('button');retry.className='retry-button';retry.textContent='Try again';retry.addEventListener('click',()=>location.reload());$('#loading').append(retry);
});
