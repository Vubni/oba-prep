import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory()){if(/^(materials|private|originals|source-text)$/.test(e.name))throw Error('Private directory in site');await scan(p);}else{if(/\.(pdf|xlsx?|docx?|pptx?|zip|rar|7z|csv|map)$/i.test(p))throw Error('Course original or source map in site: '+p);if(/\.(mjs|js)$/.test(p))execFileSync(process.execPath,['--check',p]);if(/\.(mjs|js|html|css|json|svg)$/.test(p)&&/Изумрудов|КупиПродай|course_114[23]_materials|\/Users\/egor|sourceMappingURL/.test(await readFile(p,'utf8')))throw Error('Private source marker in '+p);}}}
await scan('site');console.log('Syntax and public-source isolation passed.');
