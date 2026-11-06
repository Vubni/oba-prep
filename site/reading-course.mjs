// Same reading SDK as the other courses. Reading never marks a topic complete.
const main=document.querySelector('#main');
if(main&&window.RyadomReadingPosition){
 const route=()=>location.hash.split('?')[0];
 window.RyadomCourseReadingPosition=window.RyadomReadingPosition.create({main,key:'ryadom-reading-place-v1:oba',currentRoute:route,
  scope(){try{const owner=localStorage.getItem('ryadom-sync-owner-v1:oba');return owner&&/^[a-zA-Z0-9_-]{1,160}$/.test(owner)?'shared-copy:'+owner:owner===null?'guest':null;}catch{return null;}},
  header:()=>document.querySelector('header'),acceptRoute:r=>/^#lesson\/(core|advanced)\/[a-z0-9-]{1,80}$/.test(r),
  context(){const root=main.querySelector('.lesson-article');return root?{root,route:route(),title:(main.querySelector('h1')?.textContent||'ОБА').slice(0,160)}:null;},
  offerOnHome:()=>/^#?(home\/(core|advanced))?$/.test(route())
 });
}
