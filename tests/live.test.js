const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('/tmp/full.html','utf8');
const errors=[];const calls=[];
const XSS='<img src=x onerror="window.__pwned=1">';
let failMode=false;
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'file:///app.html?api=https://mock-api.example',
 beforeParse(w){
  w.scrollTo=()=>{};w.scrollBy=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.onerror=m=>errors.push('window.onerror: '+m);
  w.fetch=async(url,opts)=>{
    calls.push(url);
    if(failMode)throw new Error('network down');
    if(url.includes('/api/extract'))return{ok:true,json:async()=>({text:'Hemoglobin 11.2 g/dL. LDL 3.9. '+XSS})};
    if(url.includes('/api/analyze'))return{ok:true,json:async()=>({
      summary:'SUMMARY '+XSS,
      findings:[{label:'Hb '+XSS,value:'11.2 '+XSS,status:'low',note:'note '+XSS},{label:'LDL',value:'3.9',status:'<script>bad</script>',note:'n'}],
      terms:[{term:'Term'+XSS,explain:'Exp '+XSS}],
      questions:['Q1 '+XSS,'Q2'],
      trace:[{title:'Observe '+XSS,note:'t '+XSS}],
      translations:{ms:'MS '+XSS,zh:'ZH',ja:'JA'}})};
    return{ok:false,status:404,json:async()=>({})};
  };
 }});
const w=dom.window,d=w.document;
const t=(n,f)=>{try{f();console.log('PASS',n)}catch(e){errors.push(n+': '+e.message);console.log('FAIL',n,e.message)}};
setTimeout(async()=>{
 t('boot with ?api= no crash',()=>{if(errors.length)throw Error(errors[0])});
 t('LIVE badge shown',()=>{if(!d.querySelector('.tb-right').textContent.includes('LIVE'))throw Error('no badge')});
 // live upload
 const file=new w.File(['fake pdf bytes'],'report.pdf',{type:'application/pdf'});
 await w.handleFile(file);
 await new Promise(r=>setTimeout(r,800));
 t('extract+analyze called',()=>{if(!calls.some(c=>c.includes('/api/extract'))||!calls.some(c=>c.includes('/api/analyze')))throw Error(JSON.stringify(calls))});
 t('results rendered from API',()=>{if(!d.getElementById('summaryText').textContent.includes('SUMMARY'))throw Error('summary missing')});
 t('XSS: summary inert',()=>{if(w.__pwned)throw Error('executed');if(d.querySelectorAll('#summaryText img').length)throw Error('img injected')});
 t('XSS: findings inert',()=>{if(d.querySelectorAll('#findingsCard img').length)throw Error('img in findings');if(w.__pwned)throw Error('executed')});
 t('XSS: trace inert',()=>{if(d.querySelectorAll('#traceCard img').length)throw Error('img in trace')});
 t('XSS: questions inert',()=>{if(d.querySelectorAll('#qList img').length)throw Error('img in questions')});
 t('XSS: term chip + detail inert',()=>{const c=d.querySelector('#termChips .term-chip');c.click();
   if(d.querySelectorAll('#termDetail img').length)throw Error('img in detail');if(w.__pwned)throw Error('executed')});
 t('XSS: hostile status string inert',()=>{if(d.querySelectorAll('#findingsCard script').length)throw Error('script injected')});
 t('translations updated (ms)',()=>{const tab=d.querySelector('[data-lang="ms"]');tab.click();
   setTimeout(()=>{},0);});
 await new Promise(r=>setTimeout(r,400));
 t('translation body inert + content',()=>{const b=d.getElementById('transBody');
   if(!b.textContent.includes('MS'))throw Error('ms not applied');if(b.querySelector('img'))throw Error('img in translation')});
 // failure path
 failMode=true;
 d.getElementById('results').classList.remove('show');
 await w.handleFile(new w.File(['x'],'again.pdf',{type:'application/pdf'}));
 await new Promise(r=>setTimeout(r,400));
 t('API down → Azure unavailable banner',()=>{if(!d.getElementById('uploadError').classList.contains('show'))throw Error('no banner');
   if(!d.getElementById('uploadErrorTitle').textContent.includes('Azure'))throw Error('wrong title')});
 t('API down → upload restored',()=>{if(d.getElementById('uploadWrap').style.display==='none')throw Error('upload hidden')});
 t('invalid ext still rejected in live mode',async()=>{await w.handleFile(new w.File(['x'],'evil.exe'));});
 await new Promise(r=>setTimeout(r,200));
 t('invalid ext error title',()=>{if(!d.getElementById('uploadErrorTitle').textContent.match(/Unsupported/))throw Error(d.getElementById('uploadErrorTitle').textContent)});
 console.log('\n=== LIVE-MODE RESULT:',errors.length?('FAILURES '+JSON.stringify(errors)):'ALL PASSED ===');
 process.exit(errors.length?1:0);
},900);
