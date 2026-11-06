import {KEY,parseProgress} from './store.mjs';
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function validateSnapshot(snapshot){
 if(!record(snapshot)||Object.keys(snapshot).some(key=>key!==KEY))throw Error('Копия не подходит курсу ОБА.');
 if(Object.hasOwn(snapshot,KEY))parseProgress(snapshot[KEY]);
}
export const adapter={project:'oba',keys:[KEY],validate:validateSnapshot,
 isEmpty(snapshot){validateSnapshot(snapshot);if(!Object.hasOwn(snapshot,KEY))return true;const s=parseProgress(snapshot[KEY]);return !s.done.length&&!Object.keys(s.answers).length&&Object.values(s.notes).every(x=>!x.trim())&&Object.values(s.drafts).every(x=>!x.trim())&&!s.last;},
 get disabledReason(){
  const store=window.ObaStore;if(!store)return 'ОБА загружается.';
  if(store.readonlyReason)return store.readonlyReason;
  try{const raw=localStorage.getItem(KEY);if(raw!==null)parseProgress(raw);return '';}catch{return 'Исходная копия ОБА недоступна. Синхронизация остановлена без удаления данных.';}
 }
};
if(typeof window!=='undefined')window.RyadomProfileAdapter=adapter;
