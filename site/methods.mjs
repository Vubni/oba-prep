const requireNumber=(n,name,min=-Infinity)=>{if(!Number.isFinite(n)||n<min)throw Error(name+': недопустимое значение.');return n;};
export function funnel(visits,conversion,averageOrder,variableShare=0){
 requireNumber(visits,'Посещения',0);requireNumber(conversion,'Конверсия',0);requireNumber(averageOrder,'Средний чек',0);requireNumber(variableShare,'Доля затрат',0);
 if(conversion>1||variableShare>1)throw Error('Доля должна быть от 0 до 1.');
 const orders=visits*conversion,revenue=orders*averageOrder;return {orders,revenue,contribution:revenue*(1-variableShare)};
}
export function breakeven(fixed,price,variable){
 for(const [n,name] of [[fixed,'Постоянные затраты'],[price,'Цена'],[variable,'Переменные затраты']])requireNumber(n,name,0);
 const margin=price-variable;return {margin,quantity:margin>0?fixed/margin:null};
}
export function npv(rate,flows){
 requireNumber(rate,'Ставка');if(rate<=-1||!Array.isArray(flows)||!flows.length)throw Error('Нужны потоки и ставка больше −100%.');
 return flows.reduce((sum,flow,t)=>sum+requireNumber(flow,'Поток')/((1+rate)**t),0);
}
export function discountedFlows(rate,flows){npv(rate,flows);let accumulated=0;return flows.map((flow,t)=>{const present=flow/(1+rate)**t;accumulated+=present;return {t,flow,present,accumulated};});}
export function staffing(tasks,minutes,workHours,availability){
 requireNumber(tasks,'Задачи',0);requireNumber(minutes,'Минуты',0);requireNumber(workHours,'Часы',Number.MIN_VALUE);requireNumber(availability,'Доступность',Number.MIN_VALUE);if(availability>1)throw Error('Доступность не больше 100%.');
 const workload=tasks*minutes/60,capacity=workHours*availability;return {workload,capacity,fractional:workload/capacity,people:Math.ceil(workload/capacity)};
}
export function cohort(initial,retention,margin,periods,discount=0){
 requireNumber(initial,'Клиенты',0);requireNumber(retention,'Удержание',0);requireNumber(margin,'Маржа');requireNumber(discount,'Ставка',0);
 if(retention>1||!Number.isInteger(periods)||periods<1||periods>100)throw Error('Проверь удержание и число периодов.');
 const rows=Array.from({length:periods},(_,t)=>({t,clients:initial*retention**t,contribution:initial*retention**t*margin/(1+discount)**t}));
 return {rows,total:rows.reduce((s,r)=>s+r.contribution,0)};
}
export function expectedValue(probabilities,outcomes){
 if(!Array.isArray(probabilities)||probabilities.length!==outcomes.length||!probabilities.length)throw Error('Не совпадают сценарии.');
 probabilities.forEach(p=>requireNumber(p,'Вероятность',0));outcomes.forEach(x=>requireNumber(x,'Результат'));
 if(Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)>1e-9)throw Error('Вероятности должны давать 1.');
 const mean=probabilities.reduce((s,p,i)=>s+p*outcomes[i],0),variance=probabilities.reduce((s,p,i)=>s+p*(outcomes[i]-mean)**2,0);return {mean,variance};
}
export function simulate(probabilities,outcomes,n=1000,seed=42){
 const theoretical=expectedValue(probabilities,outcomes);if(!Number.isInteger(n)||n<1||n>100000)throw Error('Проверь размер симуляции.');
 let state=seed>>>0,total=0,counts=Array(outcomes.length).fill(0);
 for(let k=0;k<n;k++){state=(Math.imul(1664525,state)+1013904223)>>>0;const u=state/4294967296;let c=0,index=probabilities.length-1;for(let i=0;i<probabilities.length;i++){c+=probabilities[i];if(u<c){index=i;break;}}counts[index]++;total+=outcomes[index];}
 return {...theoretical,sampleMean:total/n,counts};
}
export function queue(arrival,service){
 requireNumber(arrival,'Поток',0);requireNumber(service,'Мощность',Number.MIN_VALUE);const utilization=arrival/service;
 return {utilization,stable:utilization<1,waitHours:utilization<1?arrival/(service*(service-arrival)):null,backlogPerHour:Math.max(0,arrival-service)};
}
export function loan(principal,rate,months){
 requireNumber(principal,'Долг',0);requireNumber(rate,'Месячная ставка',0);if(!Number.isInteger(months)||months<1||months>1200)throw Error('Проверь срок.');
 const payment=rate===0?principal/months:principal*rate/(1-(1+rate)**(-months));let balance=principal;
 const rows=Array.from({length:months},(_,t)=>{const interest=balance*rate;const body=payment-interest;balance=Math.max(0,balance-body);return {t:t+1,payment,interest,body,balance};});return {payment,rows};
}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const configs={
 funnel:{title:'Из чего складывается выручка',intro:'Меняй одну предпосылку и следи за цепочкой: посещения → заказы → выручка. Конверсия применяется к посещениям за тот же период.',fields:[['visits','Посещения за месяц',10000,1000,30000,1000],['cr','Конверсия, %',4,1,12,.5],['check','Средний чек, ₽',1200,200,3000,100]],run:v=>{const x=funnel(v.visits,v.cr/100,v.check);return {text:`${fmt(v.visits)} × ${fmt(v.cr)}% = ${fmt(x.orders)} заказов; ${fmt(x.orders)} × ${fmt(v.check)} = ${fmt(x.revenue)} ₽ выручки. Прибыль требует вычесть затраты.`,bars:[['Заказы / 1 000',x.orders/1000],['Выручка / 1 млн ₽',x.revenue/1e6]],note:'Столбцы используют разные подписанные единицы; это схема расчёта, а не сравнение абсолютных величин.'};}},
 breakeven:{title:'Точка безубыточности',intro:'Цена и затраты заданы на одну единицу, постоянные затраты — за месяц. Модель линейна в пределах выбранного объёма.',fields:[['fixed','Постоянные затраты, ₽',120000,0,300000,10000],['price','Цена единицы, ₽',1000,100,2000,50],['variable','Переменные на единицу, ₽',600,0,1800,50]],run:v=>{const x=breakeven(v.fixed,v.price,v.variable);return {text:x.quantity===null?'Маржа неположительна: рост объёма не покроет постоянные затраты.':`Маржа = ${fmt(v.price)} − ${fmt(v.variable)} = ${fmt(x.margin)} ₽. Безубыточность = ${fmt(v.fixed)} / ${fmt(x.margin)} = ${fmt(x.quantity)} единиц; для целых единиц — ${Math.ceil(x.quantity)}.`,bars:[['Цена, ₽',v.price],['Переменные, ₽',v.variable]],note:'Нулевое основание сохранено. Цена, переменные затраты и доступная мощность должны быть проверены отдельно.'};}},
 npv:{title:'Ставка и стоимость проекта',intro:'Авторский проект: вложение 1 000 тыс. ₽ сейчас, поступления по 400 тыс. ₽ в конце каждого из трёх лет. Ставка годовая; потоки заданы в сопоставимых ценах.',fields:[['rate','Ставка за год, %',12,0,45,1]],run:v=>{const flows=[-1000,400,400,400],rows=discountedFlows(v.rate/100,flows);return {text:`NPV = −1 000 + 400/(1+r) + 400/(1+r)² + 400/(1+r)³ = ${fmt(npv(v.rate/100,flows))} тыс. ₽ при r = ${v.rate}%. ${npv(v.rate/100,flows)>=0?'Модель превышает требуемую доходность.':'Модель не достигает требуемой доходности.'}`,bars:rows.slice(1).map(r=>['Год '+r.t+', тыс. ₽',r.present]),note:'Показана приведённая стоимость поступлений. Начальные −1 000 тыс. ₽ учтены в NPV. Положительный NPV сам по себе не оценивает риск прогноза.'};}},
 staffing:{title:'Нагрузка и необходимый штат',intro:'Планируем 200 задач за неделю. Каждая занимает 30 минут. Сотрудник работает 40 часов; доступность учитывает встречи, отпуска и другие потери времени.',fields:[['tasks','Задач за неделю',200,0,600,10],['minutes','Минут на задачу',30,5,120,5],['availability','Доступность, %',80,30,100,5]],run:v=>{const x=staffing(v.tasks,v.minutes,40,v.availability/100);return {text:`Нагрузка ${fmt(x.workload)} ч; один сотрудник даёт ${fmt(x.capacity)} ч. ${fmt(x.workload)} / ${fmt(x.capacity)} = ${fmt(x.fractional)} FTE; с округлением вверх — ${x.people} человек.`,bars:[['Нагрузка, ч',x.workload],['Один сотрудник, ч',x.capacity]],note:'Резерв не добавляется второй раз, если уже включён в доступность. Равномерная нагрузка не гарантирует отсутствие очередей в часы пика.'};}},
 cohort:{title:'Как удержание меняет когорту',intro:'Начинаем со 100 новых клиентов. Маржинальный вклад активного клиента — 500 ₽ за период. Удержание постоянно, повторное привлечение и скидка по времени не моделируются.',fields:[['retention','Удержание за период, %',75,10,100,5],['margin','Маржинальный вклад, ₽',500,100,1500,50]],run:v=>{const x=cohort(100,v.retention/100,v.margin,6);return {text:`За шесть периодов ожидаемый вклад когорты = ${fmt(x.total)} ₽. На исходного клиента = ${fmt(x.total/100)} ₽; это вклад до CAC. Число клиентов после первого перехода: 100 × ${v.retention}% = ${v.retention}.`,bars:x.rows.map(r=>['Период '+(r.t+1)+', клиентов',r.clients]),note:'Горизонт конечный: при удержании 100% расчёт корректен. Формула 1/churn для бесконечной стационарной модели здесь не применяется.'};}},
 ev:{title:'Сценарии и ожидаемый результат',intro:'Есть два возможных исхода проекта: +300 тыс. ₽ при успехе и −100 тыс. ₽ при неудаче. Меняй вероятность и сравни среднее по модели с воспроизводимой симуляцией.',fields:[['probability','Вероятность успеха, %',40,0,100,5],['runs','Число испытаний',1000,100,5000,100]],run:v=>{const p=v.probability/100,x=simulate([p,1-p],[300,-100],v.runs,42);return {text:`E[X] = ${v.probability}% × 300 + ${100-v.probability}% × (−100) = ${fmt(x.mean)} тыс. ₽. Среднее ${v.runs} испытаний = ${fmt(x.sampleMean)} тыс. ₽. Одна реализация может дать убыток при положительном среднем.`,bars:[['Успехов',x.counts[0]],['Неудач',x.counts[1]]],note:'Фиксирован seed=42 для воспроизводимости. Рост числа прогонов снижает шум оценки при верных вероятностях, но не исправляет неверные предпосылки.'};}},
 queue:{title:'Загрузка и очередь',intro:'Учебная модель M/M/1: один исполнитель, независимые пуассоновские поступления, экспоненциальное время обслуживания, бесконечная очередь. Параметры заданы в час.',fields:[['arrival','Поступает заявок в час',8,1,15,1],['service','Обслуживается в час',10,2,20,1]],run:v=>{const x=queue(v.arrival,v.service);return {text:`Загрузка ρ = ${fmt(x.utilization*100)}%. ${x.stable?'Среднее ожидание до обслуживания Wq = λ/[μ(μ−λ)] = '+fmt(x.waitHours*60)+' мин.':'Стационарное среднее ожидание не существует: поток не меньше мощности.'}`,bars:[['Поступление, заявок/ч',v.arrival],['Мощность, заявок/ч',v.service]],note:'Это модель, а не универсальная формула любой очереди. Проверяй распределения, число исполнителей, приоритеты и пики.'};}},
 loan:{title:'Аннуитет и проценты',intro:'Учебный заём 100 000 ₽ на 12 месяцев. Ставка месячная; комиссии и страхование отсутствуют.',fields:[['rate','Месячная ставка, %',2,0,5,.25]],run:v=>{const x=loan(100000,v.rate/100,12);return {text:`Платёж = ${fmt(x.payment)} ₽; проценты первого месяца = ${fmt(x.rows[0].interest)} ₽, погашение долга = ${fmt(x.rows[0].body)} ₽.`,bars:x.rows.map(r=>['Месяц '+r.t+', долг, ₽',r.balance]),note:'Ставка за период платежа. В реальном договоре график зависит от дат и правил округления.'};}}
};
function barChart(bars){
 const max=Math.max(1,...bars.map(x=>Math.abs(x[1]))),chart=document.createElement('div');chart.className='model-bars';chart.setAttribute('role','img');chart.setAttribute('aria-label',bars.map(([label,value])=>label+': '+fmt(value)).join('; '));
 for(const [label,value] of bars){
  const row=document.createElement('div');row.style.cssText='margin:14px 0;font-size:12px;line-height:1.5';
  const heading=document.createElement('div');heading.style.cssText='display:flex;justify-content:space-between;gap:12px';const name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=fmt(value);heading.append(name,number);
  const track=document.createElement('div');track.style.cssText='height:12px;margin-top:5px;border-left:1px solid currentColor;background:var(--soft,#eee);border-radius:0 4px 4px 0';const fill=document.createElement('div');fill.style.cssText='height:100%;background:var(--accent,#5279ba);border-radius:0 4px 4px 0;width:'+Math.max(0,value)/max*100+'%';track.append(fill);row.append(heading,track);chart.append(row);
 }return chart;
}
export function mountWidget(host,kind){
 const config=configs[kind];if(!config)return()=>{};
 host.classList.add('method-widget');host.replaceChildren();
 const add=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;host.append(el);return el;};
 add('h3',config.title);add('p',config.intro);const form=add('div');form.className='widget-controls';const values={},ranges=[];
 const result=add('p');result.className='widget-result';result.setAttribute('aria-live','polite');const graphic=add('div');graphic.className='widget-chart';const note=add('p');note.className='widget-assumptions';
 const update=()=>{const x=config.run(values);result.textContent=x.text;graphic.replaceChildren(barChart(x.bars));note.textContent=x.note;};
 for(const [key,label,initial,min,max,step] of config.fields){
  values[key]=initial;const wrap=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),range=document.createElement('input');
  caption.textContent=label;output.textContent=fmt(initial);range.type='range';range.min=min;range.max=max;range.step=step;range.value=initial;range.setAttribute('aria-label',label);
  const oninput=()=>{values[key]=Number(range.value);output.textContent=fmt(values[key]);update();};range.addEventListener('input',oninput);ranges.push([range,oninput]);wrap.append(caption,output,range);form.append(wrap);
 }update();return()=>ranges.forEach(([r,f])=>r.removeEventListener('input',f));
}
