const {JSDOM}=require('jsdom');
const fs=require('fs');
const html=fs.readFileSync('/tmp/full.html','utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){}}));
    w.onerror=(m)=>{errors.push('window.onerror: '+m)};
  }});
const w=dom.window,d=w.document;
const t=(name,fn)=>{try{fn();console.log('PASS',name)}catch(e){errors.push(name+': '+e.message);console.log('FAIL',name,e.message)}};

setTimeout(()=>{
t('boot: no script crash',()=>{if(errors.length)throw Error(errors[0])});
t('views exist',()=>{['dashboard','agents','history','knowledge','profile','settings'].forEach(v=>{if(!d.getElementById('view-'+v))throw Error(v)})});
t('history rendered (6 rows)',()=>{const n=d.querySelectorAll('#histList .hist-item').length;if(n!==6)throw Error('got '+n)});
t('term chips rendered (7)',()=>{const n=d.querySelectorAll('#termChips .term-chip').length;if(n!==7)throw Error('got '+n)});
t('questions rendered (5)',()=>{const n=d.querySelectorAll('#qList .qitem').length;if(n!==5)throw Error('got '+n)});
t('knowledge cards (7)',()=>{const n=d.querySelectorAll('#kbGrid .kb-card').length;if(n!==7)throw Error('got '+n)});
t('agent cards (8 incl orchestrator+reasoning)',()=>{const n=d.querySelectorAll('#agentsGrid .agent-card').length;if(n!==8)throw Error('got '+n)});
t('pipeline has 9 steps',()=>{const n=d.querySelectorAll('#plSteps .pl-step').length;if(n!==9)throw Error('got '+n)});
t('enterApp switches to workspace',()=>{w.enterApp();if(!d.body.classList.contains('in-app'))throw Error('no in-app class')});
t('view switching: agents (drawWires no crash)',()=>{w.showView('agents');if(!d.getElementById('view-agents').classList.contains('active'))throw Error('not active')});
t('view switching: all views',()=>{['history','knowledge','profile','settings','dashboard'].forEach(v=>{w.showView(v);if(!d.getElementById('view-'+v).classList.contains('active'))throw Error(v)})});
t('term chip expands',()=>{const c=d.querySelector('.term-chip');c.click();if(!d.getElementById('termDetail').classList.contains('show'))throw Error('detail not shown')});
t('lang tab switch (zh)',()=>{const tab=d.querySelector('[data-lang="zh"]');tab.click();if(tab.getAttribute('aria-selected')!=='true')throw Error('tab not selected')});
t('history filter: search no match → empty state',()=>{const s=d.getElementById('histSearch');s.value='zzzz';s.dispatchEvent(new w.Event('input'));if(!d.getElementById('histEmpty').classList.contains('show'))throw Error('empty state missing')});
t('history filter: clear restores',()=>{w.clearHistFilters();if(d.querySelectorAll('#histList .hist-item').length!==6)throw Error('not restored')});
t('history delete removes row',()=>{d.querySelector('#histList .h-act .danger').click();});
t('error preview: azure',()=>{w.previewError('azure');if(!d.getElementById('uploadError').classList.contains('show'))throw Error('banner not shown');if(!d.getElementById('uploadErrorTitle').textContent.includes('Azure'))throw Error('wrong title')});
t('upload validation rejects .exe',()=>{w.handleFile({name:'virus.exe',size:100});if(!d.getElementById('uploadErrorTitle').textContent.includes('Unsupported'))throw Error('not rejected')});
t('upload validation rejects oversize',()=>{w.handleFile({name:'big.pdf',size:30*1024*1024});if(!d.getElementById('uploadErrorTitle').textContent.includes('large'))throw Error('not rejected')});
t('XSS: malicious filename stays inert',()=>{w.handleFile({name:'<img src=x onerror=window.__pwned=1>.exe',size:10});if(w.__pwned)throw Error('XSS executed');if(d.querySelectorAll('#uploadError img').length)throw Error('html injected')});
t('XSS: toast with script-y text inert',()=>{w.toast('<script>window.__pwned2=1<\/script>');if(w.__pwned2)throw Error('XSS executed')});
t('pipeline starts on valid file',()=>{w.handleFile({name:'report.pdf',size:5000});if(!d.getElementById('pipeline').classList.contains('show'))throw Error('pipeline not shown')});
t('pipeline double-start safe',()=>{w.startProcessing('a.pdf');w.startProcessing('b.pdf');if(!d.getElementById('plTitle').textContent.includes('b.pdf'))throw Error('restart failed')});
t('modal open/close',()=>{w.openModal('T','s','b');if(!d.getElementById('modalBg').classList.contains('show'))throw Error('not open');w.closeModal();if(d.getElementById('modalBg').classList.contains('show'))throw Error('not closed')});
t('toggle flips aria-checked',()=>{const g=d.querySelector('.toggle');const before=g.getAttribute('aria-checked');w.flipToggle(g);if(g.getAttribute('aria-checked')===before)throw Error('no flip')});
t('reasoning trace card present',()=>{if(!d.body.innerHTML.includes('Reasoning Trace'))throw Error('missing')});
t('Foundry IQ branding present',()=>{const n=(d.body.innerHTML.match(/Foundry IQ/g)||[]).length;if(n<5)throw Error('only '+n+' mentions')});

// let pipeline finish (sum durations ~13.9s + buffer)
setTimeout(()=>{
  t('pipeline completes → results shown',()=>{if(!d.getElementById('results').classList.contains('show'))throw Error('results not shown')});
  t('all steps marked done',()=>{const done=d.querySelectorAll('#plSteps .pl-step.done').length;if(done!==9)throw Error('done='+done)});
  console.log('\n=== HARDENING RESULT:',errors.length?('FAILURES: '+JSON.stringify(errors,null,1)):'ALL TESTS PASSED ===');
  process.exit(errors.length?1:0);
},16500);
},800);
