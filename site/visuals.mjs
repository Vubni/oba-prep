const wrap=(label,body)=>`<svg class="topic-visual" viewBox="0 0 280 112" role="img" aria-label="${label}"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const grid='<path class="visual-grid" d="M20 84H260M20 55H260M20 26H260"/>';
export function visual(kind='product'){
const scenes={
product:wrap('Воронка: от интереса к покупке',`<path class="visual-tint" d="M30 23h135l-18 20H48Z"/><path class="visual-tint" d="M50 50h95l-16 20H66Z"/><path class="visual-solid" d="M69 77h57l-12 20H81Z"/><path class="visual-light" d="M185 33h50m-50 27h35m-35 27h19"/><circle cx="250" cy="33" r="4"/><circle cx="235" cy="60" r="4"/><circle cx="219" cy="87" r="4"/>`),
market:wrap('Сравнение сегментов и роста продаж',`${grid}<path class="visual-tint" d="M35 84V57h23v27m17 0V38h23v46m17 0V46h23v38m17 0V27h23v57m17 0V34h23v50"/><path class="visual-trend" d="m44 49 42-17 42 9 41-23 40 5"/><circle cx="169" cy="18" r="3" class="visual-dot"/>`),
operations:wrap('Процесс: вход, обработка, выход',`<rect class="visual-tint" x="24" y="38" width="53" height="37" rx="9"/><rect class="visual-tint" x="112" y="38" width="53" height="37" rx="9"/><rect class="visual-solid" x="200" y="38" width="53" height="37" rx="9"/><path d="M77 56h35m-7-5 7 5-7 5m60-5h35m-7-5 7 5-7 5"/><path class="visual-light" d="M35 47h30m-30 9h23m-23 9h18m58-17h30m-30 9h23m-23 9h18"/>`),
finance:wrap('Денежные потоки во времени',`${grid}<path d="M32 88h220"/><path class="visual-negative" d="M49 84v20h24V84"/><path class="visual-tint" d="M99 84V49h24v35m26 0V35h24v49m26 0V22h24v62"/><path class="visual-light" d="m51 24 40 6 45 9 46 7 42 7"/>`),
bank:wrap('Активы и источники финансирования',`<rect class="visual-tint" x="42" y="20" width="70" height="74" rx="6"/><rect class="visual-solid" x="168" y="20" width="70" height="26" rx="5"/><rect class="visual-tint" x="168" y="53" width="70" height="41" rx="5"/><path d="M128 51h24m-24 12h24"/><path class="visual-light" d="M54 36h44m-44 12h34m-34 12h39m-39 12h27m98-6h43m-43 12h30"/>`),
strategy:wrap('Выбор решения на границе возможностей',`${grid}<path class="visual-trend" d="M30 86C75 84 88 43 130 38s51-12 104-19"/><circle class="visual-dot" cx="130" cy="38" r="5"/><path class="visual-light" d="M130 38v46m0-46H21"/><circle cx="78" cy="69" r="3"/><circle cx="190" cy="27" r="3"/>`)};
return scenes[kind]||scenes.product;
}
export function icon(kind='home'){
const paths={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',product:'M4 4h16l-6 8v7l-4 2v-9Z',market:'M4 20V10m8 10V4m8 16v-7M3 21h18',operations:'M3 7h5v10H3Zm13 0h5v10h-5ZM8 12h8m-3-3 3 3-3 3',finance:'M4 18 9 9l5 4 6-9M4 21h17',bank:'m3 8 9-5 9 5M4 10h16M6 11v8m6-8v8m6-8v8M3 21h18',strategy:'M4 20 10 8l5 7 5-11M15 4h5v5',lab:'M9 3h6m-5 0v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 15h8',coverage:'M5 3h11l4 4v14H5ZM15 3v5h5M8 12h8m-8 4h8'};
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${`<path d="${paths[kind]||paths.home}"/>`}</svg>`;
}
