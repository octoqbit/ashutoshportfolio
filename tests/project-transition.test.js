import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectTransition } from '../project-transition.js';
class Surface extends EventTarget {
  constructor() { super(); this.style = {}; this.children = []; }
  setAttribute() {}
  append(child) { this.children.push(child); child.parent = this; }
  prepend(child) { this.children.unshift(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  getBoundingClientRect() { return { left: 80, top: 320, width: 1040, height: 580 }; }
}
function environment(t) {
  const names = ['document','window','innerHeight','requestAnimationFrame','cancelAnimationFrame'];
  const originals = names.map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const doc = new Surface(), win = new Surface(), reduced = new Surface(), body = new Surface();
  reduced.matches = false; doc.hidden = false; doc.body = body;
  doc.documentElement = { clientWidth: 1200 }; doc.createElement = () => new Surface();
  const source = Object.assign(new Surface(), { src: '/media/tesla.webp' });
  const target = Object.assign(new Surface(), { src: source.src }); target.style.opacity = '.85';
  doc.querySelector = () => target;
  const box = new Surface(); box.querySelector = () => source;
  const callbacks = new Map(); let id = 0, time = 0;
  Object.assign(globalThis,{document:doc,window:win,innerHeight:900,
    requestAnimationFrame:fn=>{callbacks.set(++id,fn);return id;},
    cancelAnimationFrame:key=>callbacks.delete(key)});
  t.after(()=>originals.forEach(([key,descriptor])=>descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key]));
  async function advance() {
    time+=100; const work=[...callbacks.values()]; callbacks.clear(); work.forEach(fn=>fn(time));
    await Promise.resolve(); await Promise.resolve();
  }
  return { doc, reduced, body, target, box, callbacks, advance };
}
test('Project banner fills the viewport before committing and restores the detail cover',async t=>{
  const env=environment(t);let progress=0,commits=0,finished=0;
  const transition=createProjectTransition(()=>({canvas:new Surface(),paint:p=>{progress=p;},finish:()=>{finished++;}}),env.reduced);
  const done=transition.run(env.box,()=>{commits++;assert.equal(progress,1);assert.equal(env.body.children.length,1);});
  await env.advance();await env.advance();assert.equal(commits,0);
  for(let i=0;i<30;i++)await env.advance();await done;
  assert.equal(commits,1);assert.equal(finished,1);assert.equal(env.body.children.length,0);
  assert.equal(env.target.style.opacity,'.85');assert.equal(env.callbacks.size,0);
});
test('Reduced motion skips project expansion and hidden tabs finish an in-progress flight',async t=>{
  const env=environment(t);let creations=0,commits=0;
  const transition=createProjectTransition(()=>{creations++;return null;},env.reduced);
  env.reduced.matches=true;await transition.run(env.box,()=>{commits++;});
  assert.equal(creations,0);assert.equal(env.callbacks.size,0);
  env.reduced.matches=false;const done=transition.run(env.box,()=>{commits++;});
  env.doc.hidden=true;env.doc.dispatchEvent(new Event('visibilitychange'));await done;
  assert.equal(commits,2);assert.equal(env.callbacks.size,0);assert.equal(env.body.children.length,0);
});
test('Failed GPU flight falls back to the image and render failure releases the overlay',async t=>{
  const env=environment(t);let finished=0;
  const transition=createProjectTransition(()=>({canvas:new Surface(),paint(){throw Error('GPU lost');},finish(){finished++;}}),env.reduced);
  const done=transition.run(env.box,()=>{throw Error('Render failed');});
  const rejection=assert.rejects(done,/Render failed/);
  for(let i=0;i<20;i++)await env.advance();await rejection;
  assert.equal(finished,1);assert.equal(env.body.children.length,0);assert.equal(env.callbacks.size,0);
  env.reduced.matches=true;await transition.run(env.box,()=>{});
});
