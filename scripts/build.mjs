import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('site','dist/site',{recursive:true});
console.log('Built original OBA teaching site.');
