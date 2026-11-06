export const KEY='ryadom-oba-v1';
export const MAX_BYTES=7*1024*1024;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const levels=new Set(['core','advanced']);
const id=/^(core|advanced):[a-z0-9-]+(?::[a-z0-9-]+)?$/;
const clone=v=>JSON.parse(JSON.stringify(v));
export const initialState=()=>({version:1,level:'core',done:[],answers:{},notes:{},drafts:{},reading:{},last:null,variants:{notes:{},drafts:{},answers:{}},updatedAt:0});
function safeTree(v,depth=0){if(depth>50)throw Error('Слишком сложная копия.');if(v&&typeof v==='object'){for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Некорректное поле копии.');safeTree(v[k],depth+1);}}}
export function parseProgress(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Копия ОБА повреждена или превышает 7 МБ.');
 const v=JSON.parse(raw);safeTree(v);
 if(!plain(v)||v.version!==1||!levels.has(v.level)||!Array.isArray(v.done)||v.done.some(x=>typeof x!=='string'||!id.test(x))||new Set(v.done).size!==v.done.length)throw Error('Неизвестный формат сохранения ОБА.');
 for(const field of ['answers','notes','drafts','reading'])if(!plain(v[field]))throw Error('Повреждено поле '+field+'.');
 for(const field of ['notes','drafts'])for(const [key,text] of Object.entries(v[field]))if(!id.test(key)||typeof text!=='string'||text.length>100000)throw Error('Повреждена заметка или черновик.');
 for(const [key,a] of Object.entries(v.answers))if(!id.test(key)||!plain(a)||!['string','number'].includes(typeof a.value)||typeof a.correct!=='boolean'||!Number.isSafeInteger(a.attempts)||a.attempts<1||!Number.isSafeInteger(a.updatedAt)||a.updatedAt<0)throw Error('Повреждён ответ.');
 for(const [key,p] of Object.entries(v.reading))if(!id.test(key)||!plain(p)||typeof p.anchor!=='string'||!Number.isFinite(p.ratio)||p.ratio<0||p.ratio>1||!Number.isSafeInteger(p.updatedAt))throw Error('Повреждено место чтения.');
 if(v.last!==null&&(!plain(v.last)||!levels.has(v.last.level)||typeof v.last.lesson!=='string'||!/^[a-z0-9-]+$/.test(v.last.lesson)))throw Error('Повреждена последняя тема.');
 if(!Number.isSafeInteger(v.updatedAt)||v.updatedAt<0)throw Error('Повреждена дата сохранения.');
 if(v.variants!==undefined&&!plain(v.variants))throw Error('Повреждены варианты записей.');
 for(const [field,items] of Object.entries(v.variants||{})){
  if(!plain(items))throw Error('Повреждены варианты записей.');
  for(const [key,values] of Object.entries(items)){
   if(!Array.isArray(values))throw Error('Повреждён список вариантов.');
   if(['notes','drafts','answers'].includes(field)&&!id.test(key))throw Error('Повреждён идентификатор варианта.');
   if(['notes','drafts'].includes(field)&&values.some(x=>typeof x!=='string'))throw Error('Повреждён текст варианта.');
   if(field==='answers'&&values.some(x=>!plain(x)||!['number','string'].includes(typeof x.value)||typeof x.correct!=='boolean'||!Number.isSafeInteger(x.attempts)||x.attempts<1||!Number.isSafeInteger(x.updatedAt)))throw Error('Повреждён вариант ответа.');
  }
 }
 return v;
}
function mergeField(a,b,path,variants){
 const next={...a,...b};
 for(const key of Object.keys(a))if(Object.hasOwn(b,key)&&JSON.stringify(a[key])!==JSON.stringify(b[key])){
  const values=[...(variants[path]?.[key]||[]),a[key],b[key]];
  variants[path]??={};variants[path][key]=[...new Map(values.map(x=>[JSON.stringify(x),clone(x)])).values()];
 }
 return next;
}
export function mergeProgress(a,b){
 parseProgress(JSON.stringify(a));parseProgress(JSON.stringify(b));
 const variants={};
 for(const field of new Set([...Object.keys(a.variants||{}),...Object.keys(b.variants||{})])){
  variants[field]={};for(const key of new Set([...Object.keys(a.variants?.[field]||{}),...Object.keys(b.variants?.[field]||{})])){
   const values=[...(a.variants?.[field]?.[key]||[]),...(b.variants?.[field]?.[key]||[])];variants[field][key]=[...new Map(values.map(x=>[JSON.stringify(x),clone(x)])).values()];
  }
 }
 const recent=a.updatedAt>b.updatedAt?a:b,older=recent===a?b:a;
 const result={...clone(older),...clone(recent),done:[...new Set([...a.done,...b.done])],variants};
 for(const field of ['notes','drafts','answers'])result[field]=mergeField(older[field],recent[field],field,variants);
 for(const [key,answer] of Object.entries(older.answers))if(answer.updatedAt>(recent.answers[key]?.updatedAt??-1))result.answers[key]=clone(answer);
 result.reading={...older.reading,...recent.reading};
 for(const [key,value] of Object.entries(older.reading))if((value.updatedAt||0)>(recent.reading[key]?.updatedAt||0))result.reading[key]=clone(value);
 // Unknown extension fields are retained. Conflicting extensions stay in full variants.
 for(const key of Object.keys(older))if(!['version','level','done','answers','notes','drafts','reading','last','variants','updatedAt'].includes(key)&&Object.hasOwn(recent,key)&&JSON.stringify(older[key])!==JSON.stringify(recent[key])){
  variants.extensions??={};variants.extensions[key]=[clone(older[key]),clone(recent[key])];
 }
 return result;
}
export class Store{
 constructor(storage){
  this.state=initialState();this.listeners=new Set();this.raw=null;this.problem='';
  try{this.storage=storage??globalThis.localStorage;if(!this.storage)throw Error();this.reload(false);}catch{this.problem='Хранилище браузера недоступно. Записи не изменены.';}
  if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null)this.reload();});
 }
 get readonlyReason(){return this.problem;}
 subscribe(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
 emit(){for(const f of this.listeners)f(this.state);}
 reload(notify=true){
  try{const raw=this.storage.getItem(KEY);const next=raw===null?initialState():parseProgress(raw);this.raw=raw;this.state=next;this.problem='';}catch{this.problem='Сохранение ОБА не удалось прочитать. Исходная копия сохранена; запись и синхронизация приостановлены.';}
  if(notify)this.emit();return !this.problem;
 }
 change(edit){
  if(this.problem)return false;
  try{
   const raw=this.storage.getItem(KEY);let base=clone(this.state);
   if(raw!==this.raw){if(raw===null)throw Error('Сохранение изменено в другой вкладке. Перезагрузи страницу.');base=mergeProgress(base,parseProgress(raw));}
   edit(base);base.updatedAt=Date.now();const encoded=JSON.stringify(base);parseProgress(encoded);
   this.storage.setItem(KEY,encoded);if(this.storage.getItem(KEY)!==encoded)throw Error('Браузер не подтвердил запись.');
   this.raw=encoded;this.state=base;this.emit();return true;
  }catch{this.problem='Не удалось сохранить изменения. Прежняя копия не очищена. Скопируй введённый текст и проверь хранилище браузера.';this.emit();return false;}
 }
 setLevel(level){if(!levels.has(level))return false;return this.change(s=>{s.level=level;});}
 markDone(level,lesson,value=true){const key=this.key(level,lesson);return this.change(s=>{s.done=s.done.filter(x=>x!==key);if(value)s.done.push(key);});}
 answer(level,lesson,task,value,correct){const key=this.key(level,lesson,task);return this.change(s=>{s.answers[key]={value,correct:!!correct,attempts:(s.answers[key]?.attempts||0)+1,updatedAt:Date.now()};});}
 note(level,lesson,text){const key=this.key(level,lesson);return this.change(s=>{s.notes[key]=text;});}
 draft(level,lesson,task,text){const key=this.key(level,lesson,task);return this.change(s=>{s.drafts[key]=text;});}
 visit(level,lesson){this.key(level,lesson);if(this.state.last?.level===level&&this.state.last?.lesson===lesson)return true;return this.change(s=>{s.level=level;s.last={level,lesson};});}
 key(level,lesson,task){const key=[level,lesson,...(task?[task]:[])].join(':');if(!id.test(key))throw Error('Некорректный идентификатор темы.');return key;}
}
