import test from 'node:test';import assert from 'node:assert/strict';
import {lessons as core} from '../site/core-lessons.mjs';import {lessons as advanced} from '../site/advanced-lessons.mjs';
for(const [level,lessons] of Object.entries({core,advanced})){
 test(`${level}: every lesson has stable sections, worked explanation and original practice`,()=>{
  assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);assert(lessons.length>=18);
  for(const l of lessons){assert.match(l.id,/^[a-z0-9-]+$/);assert(Number.isInteger(l.week)&&l.week>=1&&l.week<=10);assert(l.title&&l.description&&l.sourceNote);assert(l.goals.length>=2);assert(l.sections.length>=4);assert.equal(new Set(l.sections.map(s=>s.id)).size,l.sections.length);assert(l.practice.length>=2);assert.equal(new Set(l.practice.map(p=>p.id)).size,l.practice.length);
   const html=l.sections.map(s=>s.html).join('');assert(html.replace(/<[^>]+>/g,' ').split(/\s+/).length>300,`${l.id} explanation`);assert(!/<(?:script|iframe|form|details)\b/i.test(html));assert(!/https?:[^\s<>"']+\.(?:pdf|xlsx?|pptx?|docx?)/i.test(html));
   for(const s of l.sections){assert.match(s.id,/^[a-z0-9-]+$/);assert(s.title&&s.html.length>80);}
   for(const p of l.practice){assert.match(p.id,/^[a-z0-9-]+$/);assert(p.prompt.length>20&&p.explanation.length>25);assert(['choice','number'].includes(p.type));if(p.type==='number'){assert(Number.isFinite(p.answer));assert(p.tolerance===undefined||Number.isFinite(p.tolerance)&&p.tolerance>=0);}else{assert(p.choices.length>=2);assert.equal(new Set(p.choices.map(x=>String(x.value))).size,p.choices.length);assert(p.choices.some(x=>String(x.value)===String(p.answer)));}}
  }
 });
}
test('level namespaces never conflate equal lesson/task ids',()=>{const keys=Object.entries({core,advanced}).flatMap(([level,list])=>list.flatMap(l=>l.practice.map(p=>[level,l.id,p.id].join(':'))));assert.equal(new Set(keys).size,keys.length);});
