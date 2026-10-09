import * as THREE from 'three/webgpu';
import { pass, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { buildRoom, walkAreas } from './room';

export const viewpoints = {
  entry: { position: [-0.95,1.58,1.35], target: [0.10,1.30,-3.24], title:'The entrance', number:'01' },
  living: { position: [-1.25,1.58,-1.6], target: [3.3,1.28,0.65], title:'The living room', number:'02' },
  kitchen: { position: [-0.85,1.58,-1.85], target: [0.25,1.30,4.6], title:'Toward the kitchen', number:'03' },
} as const;
export type ViewName = keyof typeof viewpoints;

export class RoomViewer {
  renderer!: THREE.WebGPURenderer;
  post!: THREE.PostProcessing;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72,1,0.025,80);
  room = buildRoom(this.scene);
  sun = new THREE.DirectionalLight('#fff0d9',2.7);
  ambient = new THREE.HemisphereLight('#eef2ee','#bbb5a8',1.7);
  interior = new THREE.PointLight('#ffe0aa',8,10,2);
  livingLight = new THREE.PointLight('#ffc880',17,9,2);
  porchLight = new THREE.PointLight('#ffc587',24,8,2);
  kitchenLight = new THREE.PointLight('#f5f5e6',22,8,2);
  mode:'walk'|'plan'='walk';
  activeView:ViewName='entry';
  yaw=0; pitch=0;
  keys=new Set<string>();
  moving=false;
  private lastTime=0;
  private transition:{start:THREE.Vector3,end:THREE.Vector3,q0:THREE.Quaternion,q1:THREE.Quaternion,t:number}|null=null;
  private drag:{x:number,y:number,id:number}|null=null;
  private resizeObserver:ResizeObserver;
  private loopRunning=false;
  private dirty=true;
  private framePending=false;
  onMove?: (x:number,z:number,yaw:number)=>void;
  onInteract?:()=>void;

  constructor(private container:HTMLElement) {
    this.scene.background=new THREE.Color('#d7d8cf');
    this.scene.add(this.ambient);
    this.sun.position.set(-1.3,2.72,-4.25);
    this.sun.target.position.set(0.5,0,0.2);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);
    this.sun.shadow.camera.left=-5;this.sun.shadow.camera.right=5;
    this.sun.shadow.camera.top=5;this.sun.shadow.camera.bottom=-5;
    this.sun.shadow.camera.near=0.1;this.sun.shadow.camera.far=20;
    this.sun.shadow.normalBias=0.022;this.sun.shadow.bias=-0.00015;
    this.sun.shadow.radius=3;
    this.scene.add(this.sun,this.sun.target);
    this.interior.position.set(0.1,2.55,0.45);
    this.livingLight.position.set(3.15,2.5,0.65);
    this.porchLight.position.set(-0.5,2.65,-4.15);
    this.kitchenLight.position.set(0.1,2.5,4.6);
    this.scene.add(this.interior,this.livingLight,this.porchLight,this.kitchenLight);
    this.setView('entry',false);
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(container);
  }

  async init() {
    if(!navigator.gpu)throw new Error('WebGPU is not available in this browser. Open this room in a current version of Chrome or Edge with hardware acceleration enabled.');
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)throw new Error('A WebGPU adapter could not be started. Enable hardware acceleration and reload in a WebGPU-compatible browser.');
    // Let Three request its supported GPU features; explicitly prohibit WebGL fallback.
    const softwareGPU=/swiftshader|llvmpipe|software/i.test(`${adapter.info.architecture} ${adapter.info.device} ${adapter.info.description}`);
    this.renderer=new THREE.WebGPURenderer({antialias:false,alpha:false});
    (this.renderer as unknown as {_getFallback:null})._getFallback=null;
    this.renderer.setPixelRatio(softwareGPU?1:Math.min(window.devicePixelRatio,1.6));
    if(softwareGPU)this.sun.shadow.mapSize.set(1024,1024);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.02;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    await this.renderer.init();
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Interactive 3D reconstruction of the empty room. Drag to look; use W A S D or arrow keys to walk.');
    this.renderer.domElement.tabIndex=0;
    this.resize();
    const scenePass=pass(this.scene,this.camera,{samples:0});
    const sceneColor=scenePass.getTextureNode('output');
    // GTAO supports depth-reconstructed normals; current type definitions omit null.
    // @ts-expect-error The Three.js implementation explicitly permits null here.
    const ambientOcclusion=ao(scenePass.getTextureNode('depth'),null,this.camera);
    ambientOcclusion.resolutionScale=0.5;
    ambientOcclusion.radius.value=0.24;
    ambientOcclusion.samples.value=8;
    ambientOcclusion.thickness.value=0.5;
    this.post=new THREE.PostProcessing(this.renderer);
    this.post.outputNode=fxaa(vec4(sceneColor.rgb.mul(ambientOcclusion.getTextureNode().r.mul(0.6).add(0.4)),sceneColor.a));
    this.bindNavigation();
    // Submit the first frame, then keep presentation driven by the browser's frame loop.
    this.renderFrame();
    this.loopRunning=true;
    this.renderer.setAnimationLoop(this.animate);
  }

  setView(name:ViewName,animate=true) {
    this.dirty=true;
    this.activeView=name;
    this.mode='walk';this.room.overhead.visible=true;
    this.camera.fov=72;this.camera.updateProjectionMatrix();
    const v=viewpoints[name];
    const end=new THREE.Vector3(...v.position);
    const temp=new THREE.PerspectiveCamera();temp.position.copy(end);temp.lookAt(new THREE.Vector3(...v.target));
    if(animate)this.transition={start:this.camera.position.clone(),end,q0:this.camera.quaternion.clone(),q1:temp.quaternion.clone(),t:0};
    else{this.camera.position.copy(end);this.camera.quaternion.copy(temp.quaternion);this.syncAngles();}
  }
  setPlan() {
    this.dirty=true;
    this.mode='plan';this.room.overhead.visible=false;
    this.transition=null;
    this.camera.position.set(7.7,12.8,9.9);
    this.camera.lookAt(0.5,0,0.6);this.camera.fov=43;this.camera.updateProjectionMatrix();
    this.syncAngles();
  }
  setLight(value:number) {
    this.dirty=true;
    const t=value/100;
    this.sun.intensity=0.25+t*2.45;
    this.ambient.intensity=0.65+t*1.05;
    this.ambient.color.set(t<0.45?'#ffe5c3':'#eef2ee');
    this.sun.color.set(t<0.45?'#ffbc74':'#fff0d9');
    this.interior.intensity=8+(1-t)*18;
    this.livingLight.intensity=17+(1-t)*9;
    this.porchLight.intensity=24+(1-t)*8;
    if(this.renderer)this.renderer.toneMappingExposure=0.93+t*0.09;
  }
  private syncAngles() {
    const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
    this.yaw=e.y;this.pitch=e.x;
  }
  private resize() {
    this.dirty=true;
    const w=this.container.clientWidth,h=this.container.clientHeight;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w,h);
  }
  private bindNavigation() {
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      this.drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);
      this.transition=null;canvas.classList.add('dragging');canvas.focus();this.onInteract?.();
    });
    canvas.addEventListener('pointermove',e=>{
      if(!this.drag)return;
      this.dirty=true;
      const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
      if(this.mode==='walk') {
        this.yaw-=dx*0.003;this.pitch=THREE.MathUtils.clamp(this.pitch-dy*0.003,-1.10,1.1);
        this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch,this.yaw,0,'YXZ'));
      } else {
        const offset=this.camera.position.clone().sub(new THREE.Vector3(0.5,0,0.6));
        const spherical=new THREE.Spherical().setFromVector3(offset);
        spherical.theta-=dx*0.006;spherical.phi=THREE.MathUtils.clamp(spherical.phi-dy*0.004,0.1,1.15);
        this.camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(new THREE.Vector3(0.5,0,0.6)));
        this.camera.lookAt(0.5,0,0.6);
      }
      this.drag.x=e.clientX;this.drag.y=e.clientY;
    });
    const end=()=>{this.drag=null;canvas.classList.remove('dragging');};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('wheel',e=>{
      this.dirty=true;
      e.preventDefault();this.transition=null;this.onInteract?.();
      if(this.mode==='plan') {
        this.camera.fov=THREE.MathUtils.clamp(this.camera.fov+e.deltaY*0.018,25,65);this.camera.updateProjectionMatrix();
      }else this.move(0,-e.deltaY*0.0025);
    },{passive:false});
    window.addEventListener('keydown',e=>{
      if((e.target as HTMLElement).matches('input,button,select,textarea'))return;
      if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();this.keys.add(e.key.toLowerCase());this.transition=null;this.onInteract?.();
      }
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>{this.keys.clear();end();});
    document.addEventListener('visibilitychange',()=>{this.lastTime=0;});
  }
  move(side:number,forward:number) {
    if(this.mode!=='walk')return;
    this.dirty=true;
    const nx=this.camera.position.x+Math.cos(this.yaw)*side-Math.sin(this.yaw)*forward;
    const nz=this.camera.position.z-Math.sin(this.yaw)*side-Math.cos(this.yaw)*forward;
    const canWalk=(x:number,z:number)=>walkAreas.some(([x0,x1,z0,z1])=>x>x0&&x<x1&&z>z0&&z<z1);
    if(canWalk(nx,this.camera.position.z))this.camera.position.x=nx;
    if(canWalk(this.camera.position.x,nz))this.camera.position.z=nz;
  }
  private animate=(time:number)=>{
    if(!this.loopRunning)return;
    const delta=this.lastTime ? Math.min((time-this.lastTime)/1000,0.05) : 0.016;
    this.lastTime=time;
    if(this.transition) {
      this.dirty=true;
      this.transition.t=Math.min(1,this.transition.t+delta/1.25);
      const t=this.transition.t, ease=t*t*(3-2*t);
      this.camera.position.lerpVectors(this.transition.start,this.transition.end,ease);
      this.camera.quaternion.slerpQuaternions(this.transition.q0,this.transition.q1,ease);
      if(t===1){this.transition=null;this.syncAngles();}
    }
    const speed=delta*1.45;
    const forward=(Number(this.keys.has('w')||this.keys.has('arrowup'))-Number(this.keys.has('s')||this.keys.has('arrowdown')))*speed;
    const side=(Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')))*speed;
    if(forward||side)this.move(side,forward);
    if(this.room.door.userData.target!==undefined&&Math.abs(this.room.door.rotation.y-this.room.door.userData.target)>0.0001){
      this.room.door.rotation.y=THREE.MathUtils.damp(this.room.door.rotation.y,this.room.door.userData.target,5,delta);
      this.dirty=true;
    }
    this.onMove?.(this.camera.position.x,this.camera.position.z,this.yaw);
    if(this.dirty&&!this.framePending)this.renderFrame();
  };
  private renderFrame() {
    this.dirty=false;
    this.framePending=true;
    this.post.render();
    const device=(this.renderer.backend as unknown as {device:GPUDevice}).device;
    device.queue.onSubmittedWorkDone().then(()=>{this.framePending=false;}).catch(()=>{this.framePending=false;});
  }
  dispose() {
    this.loopRunning=false;this.renderer?.setAnimationLoop(null);this.resizeObserver.disconnect();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    Object.values(this.room.materials).forEach(m=>m.dispose());
    this.post?.dispose();this.renderer?.dispose();
  }
}
