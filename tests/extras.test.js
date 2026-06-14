const {JSDOM}=require('jsdom');const fs=require('fs');
const errors=[];
const dom=new JSDOM(fs.readFileSync('/tmp/full.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'file:///a.html',
 beforeParse(w){w.scrollTo=()=>{};w.scrollBy=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.onerror=m=>errors.push(String(m))}});
const w=dom.window,d=w.document;
const t=(n,f)=>{try{f();console.log('PASS',n)}catch(e){errors.push(n+': '+e.message);console.log('FAIL',n,e.message)}};
setTimeout(()=>{
 t('boot clean',()=>{if(errors.length)throw Error(errors[0])});
 t('body map rendered (4 organs, 4 rows)',()=>{
   if(d.querySelectorAll('.bm-organ').length!==4)throw Error('organs');
   if(d.querySelectorAll('#bmList .bm-item').length!==4)throw Error('rows')});
 t('flagged organs pulse (2)',()=>{if(d.querySelectorAll('.bm-organ.flag').length!==2)throw Error('flags')});
 t('organ click selects row',()=>{d.querySelector('.bm-organ[data-bm="heart"]').dispatchEvent(new w.Event('click',{bubbles:true}));
   if(!d.querySelector('.bm-item[data-bm="heart"]').classList.contains('sel'))throw Error('not selected')});
 t('row keyboard select (Enter)',()=>{const r=d.querySelector('.bm-item[data-bm="kidneys"]');
   r.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
   if(!r.classList.contains('sel'))throw Error('kbd select failed')});
 t('dark mode toggles class + aria',()=>{w.enterApp();w.toggleDark();
   if(!d.body.classList.contains('dark'))throw Error('no class');
   if(d.getElementById('darkToggle').getAttribute('aria-checked')!=='true')throw Error('aria');
   w.toggleDark();if(d.body.classList.contains('dark'))throw Error('not removed')});
 t('read-aloud graceful without speechSynthesis',()=>{w.speakSummary();/* jsdom has none → toast path, no crash */});
 t('listen button exists',()=>{if(!d.getElementById('listenBtn'))throw Error('missing')});
 console.log('=== EXTRAS:',errors.length?'FAIL '+JSON.stringify(errors):'ALL PASSED ===');
 process.exit(errors.length?1:0);
},800);
