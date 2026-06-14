/* ============ helpers ============ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function toast(msg){
  const t=document.createElement('div');t.className='toast';
  t.innerHTML='<svg><use href="#i-check"/></svg><span></span>';
  t.querySelector('span').textContent=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320)},3200);
}
function copyText(id){
  const el=document.getElementById(id);
  navigator.clipboard?.writeText(el.innerText).then(()=>toast('Copied to clipboard'),()=>toast('Copy not available in this preview'));
}
function flipToggle(t){t.setAttribute('aria-checked',t.getAttribute('aria-checked')==='true'?'false':'true')}

/* ripple */
document.addEventListener('click',e=>{
  const b=e.target.closest('.btn');if(!b)return;
  const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height);
  const i=document.createElement('span');i.className='ripple';
  i.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  b.appendChild(i);setTimeout(()=>i.remove(),560);
});

/* ============ landing ============ */
const navbar=$('#navbar');
addEventListener('scroll',()=>navbar&&navbar.classList.toggle('scrolled',scrollY>14),{passive:true});
const io='IntersectionObserver'in window?new IntersectionObserver(es=>es.forEach(x=>x.isIntersecting&&x.target.classList.add('visible')),{threshold:.12}):null;
$$('.reveal').forEach(el=>io?io.observe(el):el.classList.add('visible'));

function enterApp(demo){
  document.body.classList.add('in-app');
  scrollTo(0,0);
  if(demo)setTimeout(startDemo,600);
}
function exitApp(){document.body.classList.remove('in-app');scrollTo(0,0)}

/* ============ view switching ============ */
function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#view-'+name)?.classList.add('active');
  $$('.sb-item,[data-view]').forEach(b=>{
    if(b.dataset.view) b.classList.toggle('active',b.dataset.view===name&&!b.dataset.scroll);
  });
  $$('.mobile-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='agents')requestAnimationFrame(drawWires);
  scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-view]');if(!b)return;
  showView(b.dataset.view);
  if(b.dataset.scroll==='upload')setTimeout(()=>$('#uploadZone')?.scrollIntoView({behavior:'smooth',block:'center'}),120);
});
addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch')?.focus()}
  if(e.key==='Escape')closeModal();
});

/* ============ upload & pipeline ============ */
const zone=$('#uploadZone'),fileInput=$('#fileInput');
const OK=['pdf','png','jpg','jpeg','docx'];
zone.addEventListener('click',()=>fileInput.click());
zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}});
['dragover','dragenter'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag')}));
zone.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
fileInput.addEventListener('change',()=>handleFile(fileInput.files[0]));

function handleFile(f){
  if(!f)return;
  const ext=f.name.split('.').pop().toLowerCase();
  const err=$('#uploadError');
  if(!OK.includes(ext)){
    $('#uploadErrorTitle').textContent='Unsupported file type';
    $('#uploadErrorMsg').textContent=`"${f.name}" isn't supported. Please upload a PDF, PNG, JPEG or DOCX file (max 25 MB).`;
    err.classList.add('show');return;
  }
  if(f.size>25*1024*1024){
    $('#uploadErrorTitle').textContent='File too large';
    $('#uploadErrorMsg').textContent=`"${f.name}" is larger than 25 MB. Try compressing it first.`;
    err.classList.add('show');return;
  }
  err.classList.remove('show');
  startProcessing(f.name);
}
function startDemo(){showView('dashboard');startProcessing('Blood_Test_Report.pdf')}

function previewError(kind){
  const map={
    upload:['Upload failed','Something went wrong while uploading your document. Please try again.'],
    network:['Network error','We couldn’t reach the server. Check your connection and retry — nothing was lost.'],
    azure:['Azure service unavailable','Azure AI services are temporarily unreachable. Your document is safe and we’ll retry automatically.']
  };
  const[t,m]=map[kind];
  showView('dashboard');
  $('#uploadErrorTitle').textContent=t;
  $('#uploadErrorMsg').textContent=m;
  $('#uploadError').classList.add('show');
  setTimeout(()=>$('#uploadError').scrollIntoView({behavior:'smooth',block:'center'}),150);
}

const STEP_STATES=['Uploading','Extracting','Reading','Simplifying','Researching','Generating','Translating','Finalizing'];
let plTimer=null;
function startProcessing(name){
  clearTimeout(plTimer);
  $('#uploadWrap').style.display='none';
  $('#results').classList.remove('show');
  const pl=$('#pipeline');pl.classList.add('show');
  $('#plTitle').textContent='Analyzing '+name;
  const steps=$$('#plSteps .pl-step');
  steps.forEach(s=>{s.className='pl-step';s.querySelector('.ps-state').textContent='Queued'});
  $('#plBar').style.width='0%';$('#plPct').textContent='0%';
  pl.scrollIntoView({behavior:'smooth',block:'start'});
  const durations=[1100,1500,1600,1900,1700,1800,1500,1600,900];
  let i=0;
  (function next(){
    if(i>0){steps[i-1].classList.remove('working');steps[i-1].classList.add('done');steps[i-1].querySelector('.ps-state').textContent='Done ✓'}
    const pct=Math.round(i/steps.length*100);
    $('#plBar').style.width=pct+'%';$('#plPct').textContent=pct+'%';
    if(i>=steps.length){
      $('#plSub').innerHTML='All agents finished · compiling your briefing';
      plTimer=setTimeout(()=>{
        pl.classList.remove('show');
        $('#results').classList.add('show');
        toast('Analysis complete — 7 agents finished in 16.0s');
        $('#results').scrollIntoView({behavior:'smooth',block:'start'});
      },700);
      return;
    }
    steps[i].classList.add('working');
    steps[i].querySelector('.ps-state').innerHTML='<span class="thinking-dots"><i></i><i></i><i></i></span>';
    i++;plTimer=setTimeout(next,durations[i-1]);
  })();
}
function resetDashboard(){
  $('#results').classList.remove('show');
  $('#uploadWrap').style.display='';
  fileInput.value='';
  $('#uploadZone').scrollIntoView({behavior:'smooth',block:'center'});
}

/* ============ terms ============ */
const TERMS=[
  ['Hemoglobin','The protein in red blood cells that carries oxygen around your body. Low levels can leave you feeling tired or short of breath, and are often linked to <b>low iron</b>.'],
  ['LDL Cholesterol','Often called <b>"bad" cholesterol</b>. Too much can slowly build up in blood vessel walls. Usually improved first with diet, exercise and weight management.'],
  ['HbA1c','A measure of your <b>average blood sugar over ~3 months</b>. It\'s how doctors screen for and monitor diabetes. Yours is in the healthy range.'],
  ['eGFR','Estimated Glomerular Filtration Rate — a calculation of <b>how well your kidneys filter blood</b>. Above 90 is considered normal for most adults.'],
  ['Microcytic','Means red blood cells are <b>smaller than usual</b>. The most common cause is iron deficiency.'],
  ['Ferritin','A protein that <b>stores iron</b>. Checking it helps confirm whether low hemoglobin is caused by low iron.'],
  ['Lipid Panel','A group of tests measuring <b>fats in your blood</b> — total cholesterol, LDL, HDL and triglycerides.']
];
const chipsEl=$('#termChips'),detailEl=$('#termDetail');
TERMS.forEach(([t,d],idx)=>{
  const c=document.createElement('button');
  c.className='term-chip';c.textContent=t;c.setAttribute('aria-expanded','false');c.setAttribute('role','listitem');
  c.onclick=()=>{
    const open=c.getAttribute('aria-expanded')==='true';
    $$('.term-chip').forEach(x=>x.setAttribute('aria-expanded','false'));
    if(open){detailEl.classList.remove('show');return}
    c.setAttribute('aria-expanded','true');
    detailEl.innerHTML='<b>'+t+'</b> — '+d;
    detailEl.classList.add('show');
  };
  chipsEl.appendChild(c);
});

/* ============ questions ============ */
const QUESTIONS=[
  'My hemoglobin is slightly low — should I get an iron or ferritin test to find the cause?',
  'Are there foods or supplements you\'d recommend to bring my iron levels up?',
  'My LDL cholesterol is mildly elevated. Should we try lifestyle changes first, or discuss medication?',
  'When should I repeat these blood tests to see if things are improving?',
  'Could any of these results explain the tiredness I\'ve been feeling lately?'
];
const qList=$('#qList');
QUESTIONS.forEach((q,i)=>{
  const d=document.createElement('div');d.className='qitem';
  d.innerHTML=`<input type="checkbox" id="q${i}"><label for="q${i}">${q}</label>`;
  d.querySelector('input').addEventListener('change',e=>d.classList.toggle('checked',e.target.checked));
  qList.appendChild(d);
});
function copyQuestions(){
  navigator.clipboard?.writeText(QUESTIONS.map((q,i)=>(i+1)+'. '+q).join('\n'))
    .then(()=>toast('5 questions copied — ready for your appointment'),()=>toast('Copy not available in this preview'));
}

/* ============ translation ============ */
const TRANSLATIONS={
  en:'Overall, your blood test looks mostly healthy. Your hemoglobin is slightly low, which may mean low iron — this often explains tiredness. Your LDL ("bad") cholesterol is mildly elevated and usually improves with diet and exercise. Your blood sugar and kidney function are excellent.',
  ms:'Secara keseluruhan, ujian darah anda kelihatan sihat. Hemoglobin anda sedikit rendah, yang mungkin bermaksud kekurangan zat besi — ini sering menjelaskan keletihan. Kolesterol LDL ("jahat") anda meningkat sedikit dan biasanya bertambah baik dengan diet dan senaman. Gula darah dan fungsi buah pinggang anda sangat baik.',
  zh:'总体而言，您的血液检查结果基本健康。您的血红蛋白略低，可能意味着缺铁——这通常可以解释疲劳感。您的低密度脂蛋白（"坏"）胆固醇轻度偏高，通常通过饮食和运动即可改善。您的血糖和肾功能都非常好。',
  ja:'全体的に、血液検査の結果はおおむね健康です。ヘモグロビンがやや低く、鉄分不足の可能性があります。これは疲労感の原因になることがあります。LDL（悪玉）コレステロールが軽度に高めですが、通常は食事と運動で改善します。血糖値と腎機能は非常に良好です。'
};
$('#transBody').textContent=TRANSLATIONS.en;
$('#langTabs').addEventListener('click',e=>{
  const t=e.target.closest('.tab');if(!t)return;
  $$('#langTabs .tab').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false')});
  t.classList.add('active');t.setAttribute('aria-selected','true');
  const body=$('#transBody');
  body.style.opacity=0;
  setTimeout(()=>{body.textContent=TRANSLATIONS[t.dataset.lang];body.setAttribute('lang',t.dataset.lang);body.style.transition='opacity .3s';body.style.opacity=1},160);
});

/* ============ history ============ */
const HISTORY=[
  {name:'Blood_Test_Report.pdf',type:'Blood Test',date:'Today · 9:14 AM',status:'Completed',icon:'i-drop',color:'#0078D4',findings:'4 findings · 2 flagged'},
  {name:'MRI_Brain_Summary.pdf',type:'MRI',date:'May 28 · 2:40 PM',status:'Completed',icon:'i-brain',color:'#6B5BD2',findings:'2 findings · all explained'},
  {name:'CT_Chest_Report.pdf',type:'CT Scan',date:'May 20 · 11:05 AM',status:'Completed',icon:'i-lung',color:'#0B6F86',findings:'3 findings · 1 flagged'},
  {name:'Annual_Screening_2026.docx',type:'Screening',date:'May 12 · 4:18 PM',status:'Completed',icon:'i-pulse',color:'#107C10',findings:'All values normal'},
  {name:'Lipid_Panel_Followup.png',type:'Blood Test',date:'Apr 30 · 8:52 AM',status:'Processing',icon:'i-flask',color:'#C2497B',findings:'Agents working…'},
  {name:'Discharge_Summary_Old.pdf',type:'Summary',date:'Apr 02 · 1:22 PM',status:'Failed',icon:'i-doc',color:'#D13438',findings:'Scan quality too low — try a clearer photo'}
];
function statusBadge(s){
  if(s==='Completed')return'<span class="badge badge-green"><span class="dot" style="background:var(--success)"></span> Completed</span>';
  if(s==='Processing')return'<span class="badge badge-blue"><span class="thinking-dots"><i></i><i></i><i></i></span> Processing</span>';
  return'<span class="badge badge-red"><svg width="11" height="11"><use href="#i-warn"/></svg> Failed</span>';
}
function renderHistory(){
  const q=($('#histSearch').value||'').toLowerCase();
  const ty=$('#histType').value, st=$('#histStatus').value;
  const list=$('#histList');list.innerHTML='';
  const rows=HISTORY.filter(h=>(!q||h.name.toLowerCase().includes(q)||h.type.toLowerCase().includes(q))&&(!ty||h.type===ty)&&(!st||h.status===st));
  $('#histEmpty').classList.toggle('show',rows.length===0);
  list.style.display=rows.length?'':'none';
  rows.forEach(h=>{
    const d=document.createElement('div');d.className='hist-item';
    d.innerHTML=`<div class="card lift hist-card">
      <span class="h-ic" style="background:${h.color}1A;color:${h.color}"><svg><use href="#${h.icon}"/></svg></span>
      <div><b>${h.name}</b><div class="h-meta"><span>${h.date}</span><span>·</span><span>${h.type}</span><span>·</span><span>${h.findings}</span></div></div>
      <div class="h-act">${statusBadge(h.status)}
        <button class="icon-btn" aria-label="View ${h.name}" title="View"><svg><use href="#i-eye"/></svg></button>
        <button class="icon-btn" aria-label="Export ${h.name}" title="Export"><svg><use href="#i-download"/></svg></button>
        <button class="icon-btn danger" aria-label="Delete ${h.name}" title="Delete"><svg><use href="#i-trash"/></svg></button>
      </div></div>`;
    const[vw,ex,del]=d.querySelectorAll('.h-act .icon-btn');
    vw.onclick=()=>{showView('dashboard');$('#uploadWrap').style.display='none';$('#pipeline').classList.remove('show');$('#results').classList.add('show');toast('Opened analysis for '+h.name)};
    ex.onclick=()=>toast('Exported '+h.name+' briefing as PDF (demo)');
    del.onclick=()=>{d.style.transition='opacity .3s,transform .3s';d.style.opacity=0;d.style.transform='translateX(24px)';setTimeout(()=>{HISTORY.splice(HISTORY.indexOf(h),1);renderHistory();toast('Deleted '+h.name)},300)};
    list.appendChild(d);
  });
}
function clearHistFilters(){$('#histSearch').value='';$('#histType').value='';$('#histStatus').value='';renderHistory()}
['histSearch','histType','histStatus'].forEach(id=>document.getElementById(id).addEventListener(id==='histSearch'?'input':'change',renderHistory));
renderHistory();

/* ============ knowledge base ============ */
const TOPICS=[
  ['Heart','i-heart','linear-gradient(135deg,#D13438,#FF7A8A)','How your heart pumps, blood pressure, cholesterol and ECG basics.','Your heart is a muscular pump that moves about 5 litres of blood every minute. Reports often mention blood pressure (the force on artery walls), cholesterol (fats that can narrow arteries) and ECG readings (the heart\'s electrical rhythm). Healthy habits — movement, sleep, less salt — support all three.',24],
  ['Blood','i-drop','linear-gradient(135deg,#0078D4,#4CC2FF)','Red & white cells, hemoglobin, platelets and what counts mean.','Blood has red cells (carry oxygen via hemoglobin), white cells (fight infection) and platelets (form clots to stop bleeding). A "full blood count" measures all three. Low hemoglobin often points to iron deficiency; high white cells can simply mean your body is fighting something.',31],
  ['Bone','i-bone','linear-gradient(135deg,#9D6800,#FFB900)','Bone density, calcium, vitamin D and fracture-risk scans.','Bones constantly rebuild themselves using calcium and vitamin D. A DEXA scan measures bone density — lower density (osteopenia or osteoporosis) means higher fracture risk. Weight-bearing exercise and adequate vitamin D help keep bones strong.',18],
  ['Brain','i-brain','linear-gradient(135deg,#6B5BD2,#B07AF0)','MRI & CT basics, common findings and what they really mean.','Brain MRI and CT reports use precise language that can sound scarier than it is — "unremarkable" is good news! Common benign findings include small white-matter spots that become more frequent with age. Your doctor interprets findings alongside your symptoms.',27],
  ['Kidney','i-kidney','linear-gradient(135deg,#0B6F86,#00B7C3)','eGFR, creatinine, urine tests and kidney health.','Kidneys filter waste from your blood and balance fluids. eGFR estimates filtering power (90+ is normal); creatinine is a waste product that rises when filtering slows. Staying hydrated and managing blood pressure protect kidney health.',22],
  ['Lung','i-lung','linear-gradient(135deg,#107C10,#5EE08A)','Chest X-rays, CT scans, spirometry and breathing tests.','Lung reports may mention opacities (areas that look denser on a scan), nodules (small spots, usually benign) or spirometry results (how much air you can move). Many findings just need monitoring — your doctor will say if follow-up imaging is needed.',19],
  ['Liver','i-liver','linear-gradient(135deg,#8F4700,#E8883C)','ALT, AST, bilirubin and fatty liver explained simply.','The liver processes nutrients and filters toxins. Enzymes ALT and AST leak into blood when liver cells are stressed — mild elevations are common and often reversible. "Fatty liver" means fat stored in liver cells, usually improved by diet and exercise.',21]
];
const kb=$('#kbGrid');
TOPICS.forEach(([t,ic,bg,sub,body,n])=>{
  const c=document.createElement('button');
  c.className='card lift kb-card';
  c.innerHTML=`<span class="kb-ic" style="background:${bg}"><svg><use href="#${ic}"/></svg></span><h3>${t}</h3><p>${sub}</p><div class="kb-count">${n} articles · AI explained</div>`;
  c.onclick=()=>openModal(t,'AI explanation · grounded in WHO & NIH sources',body);
  kb.appendChild(c);
});

/* ============ modal ============ */
function openModal(title,sub,body){
  $('#modalTitle').textContent=title;
  $('#modalSub').textContent=sub;
  $('#modalBody').textContent=body;
  $('#modalBg').classList.add('show');
  document.body.style.overflow='hidden';
  setTimeout(()=>$('#modalBg .btn').focus(),80);
}
function closeModal(){$('#modalBg').classList.remove('show');document.body.style.overflow=''}

/* ============ agent wires ============ */
function drawWires(){
  const grid=$('#agentsGrid'),svg=$('#agentWires');
  if(!grid||!svg)return;
  const cards=[...grid.querySelectorAll('.agent-card')];
  const orch=cards[0];if(!orch)return;
  const gr=grid.getBoundingClientRect(),or=orch.getBoundingClientRect();
  const ox=or.left-gr.left+or.width/2, oy=or.top-gr.top+or.height;
  svg.setAttribute('viewBox',`0 0 ${gr.width} ${gr.height}`);
  let html='';
  cards.slice(1).forEach(c=>{
    const r=c.getBoundingClientRect();
    const x=r.left-gr.left+r.width/2, y=r.top-gr.top;
    html+=`<path class="wire" d="M${ox},${oy} C${ox},${oy+50} ${x},${y-50} ${x},${y}"/>`;
  });
  svg.innerHTML=html;
}
addEventListener('resize',()=>{if($('#view-agents').classList.contains('active'))drawWires()});

/* ============ global search (demo) ============ */
$('#globalSearch').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.value.trim()){
    showView('history');
    $('#histSearch').value=e.target.value;renderHistory();
    toast('Searching workspace for "'+e.target.value+'"');
  }
});

/* ============ LIVE AZURE MODE (open with ?api=https://your-function-app.azurewebsites.net) ============ */
(function(){
  const m=location.search.match(/[?&]api=([^&]+)/);
  const API=(m?decodeURIComponent(m[1]):window.MEDICARE_API||'').replace(/\/+$/,'');
  if(!API)return;
  addEventListener('load',()=>{
    const tb=document.querySelector('.tb-right');
    if(tb){const b=document.createElement('span');b.className='badge badge-green';
      b.innerHTML='<span class="dot pulse" style="background:var(--success)"></span> LIVE · Azure';tb.prepend(b)}
  });
  const steps=()=>[...document.querySelectorAll('#plSteps .pl-step')];
  function setStep(i,state){const s=steps()[i];if(!s)return;s.className='pl-step'+(state?' '+state:'');
    s.querySelector('.ps-state').innerHTML=state==='done'?'Done ✓':state==='working'?'<span class="thinking-dots"><i></i><i></i><i></i></span>':'Queued'}
  function pct(p){document.getElementById('plBar').style.width=p+'%';document.getElementById('plPct').textContent=p+'%'}
  async function post(path,body){const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||('HTTP '+r.status))}return r.json()}
  const fileB64=f=>new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res(String(rd.result).split(',')[1]);rd.onerror=rej;rd.readAsDataURL(f)});
  function esc(s){const d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}

  const origHandle=handleFile;
  handleFile=async function(f){
    if(!f)return;
    const ext=f.name.split('.').pop().toLowerCase();
    if(!['pdf','png','jpg','jpeg','docx'].includes(ext)||f.size>25*1024*1024)return origHandle(f);
    document.getElementById('uploadError').classList.remove('show');
    document.getElementById('uploadWrap').style.display='none';
    document.getElementById('results').classList.remove('show');
    const pl=document.getElementById('pipeline');pl.classList.add('show');
    document.getElementById('plTitle').textContent='Analyzing '+f.name+' — live on Azure';
    steps().forEach((s,i)=>setStep(i,''));pct(0);
    pl.scrollIntoView({behavior:'smooth',block:'start'});
    try{
      setStep(0,'working');const b64=await fileB64(f);setStep(0,'done');pct(11);
      setStep(1,'working');const ex=await post('/api/extract',{base64:b64});setStep(1,'done');pct(28);
      [2,3,4,5,6].forEach(i=>setStep(i,'working'));
      const a=await post('/api/analyze',{text:ex.text});
      [2,3,4,5,6].forEach(i=>setStep(i,'done'));pct(80);
      setStep(7,'done');pct(90);
      setStep(8,'working');render(a,f.name);setStep(8,'done');pct(100);
      setTimeout(()=>{pl.classList.remove('show');document.getElementById('results').classList.add('show');
        document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
        toast('Live analysis complete — Azure OpenAI + Document Intelligence')},500);
    }catch(e){
      pl.classList.remove('show');document.getElementById('uploadWrap').style.display='';
      document.getElementById('uploadErrorTitle').textContent='Azure service unavailable';
      document.getElementById('uploadErrorMsg').textContent=(e.message||'Request failed')+' — check the API URL and deployment, or remove ?api= to use the offline demo.';
      document.getElementById('uploadError').classList.add('show');
    }
  };

  function render(a,name){
    const Q=s=>document.querySelector(s);
    if(a.summary)Q('#summaryText').textContent=a.summary;
    Q('.res-banner b').textContent='Analysis complete — '+name;
    Q('.res-banner span').textContent='Live · Azure OpenAI + Document Intelligence · educational, not diagnostic';
    const fc=Q('#findingsCard');
    if(fc&&Array.isArray(a.findings)){fc.querySelectorAll('.finding').forEach(x=>x.remove());
      const co={normal:['rgba(22,198,12,.12)','var(--success-dark)','badge-green'],low:['rgba(255,185,0,.15)','var(--warning-dark)','badge-amber'],high:['rgba(255,185,0,.15)','var(--warning-dark)','badge-amber'],attention:['rgba(209,52,56,.1)','var(--error)','badge-red']};
      a.findings.slice(0,6).forEach(x=>{const c=co[x.status]||co.normal;
        const d=document.createElement('div');d.className='finding';
        d.innerHTML='<span class="fi-ic" style="background:'+c[0]+';color:'+c[1]+'"><svg><use href="#i-pulse"/></svg></span><div><b>'+esc(x.label)+(x.value?' — '+esc(x.value):'')+' <span class="badge '+c[2]+'" style="padding:2px 9px;font-size:10.5px">'+esc(x.status||'noted')+'</span></b><small>'+esc(x.note||'')+'</small></div>';
        fc.appendChild(d)})}
    const tc=Q('#traceCard');
    if(tc&&Array.isArray(a.trace)){tc.querySelectorAll('.finding').forEach(x=>x.remove());
      a.trace.slice(0,5).forEach((x,i)=>{const d=document.createElement('div');d.className='finding';
        d.innerHTML='<span class="fi-ic" style="background:rgba(0,120,212,.1);color:var(--azure)"><b style="font-size:13px">'+(i+1)+'</b></span><div><b>'+esc(x.title)+'</b><small>'+esc(x.note||'')+'</small></div>';
        tc.appendChild(d)})}
    if(Array.isArray(a.terms)){const tch=Q('#termChips');tch.innerHTML='';Q('#termDetail').classList.remove('show');
      a.terms.forEach(t=>{const c=document.createElement('button');c.className='term-chip';c.textContent=t.term;c.setAttribute('aria-expanded','false');
        c.onclick=()=>{document.querySelectorAll('.term-chip').forEach(x=>x.setAttribute('aria-expanded','false'));c.setAttribute('aria-expanded','true');
          const td=Q('#termDetail');td.innerHTML='<b>'+esc(t.term)+'</b> — '+esc(t.explain);td.classList.add('show')};
        tch.appendChild(c)})}
    if(Array.isArray(a.questions)){const ql=Q('#qList');ql.innerHTML='';
      a.questions.forEach((q,i)=>{const d=document.createElement('div');d.className='qitem';
        d.innerHTML='<input type="checkbox" id="lq'+i+'"><label for="lq'+i+'">'+esc(q)+'</label>';
        d.querySelector('input').addEventListener('change',e=>d.classList.toggle('checked',e.target.checked));ql.appendChild(d)})}
    if(a.translations){if(a.summary)TRANSLATIONS.en=a.summary;
      ['ms','zh','ja'].forEach(k=>{if(a.translations[k])TRANSLATIONS[k]=a.translations[k]});
      const act=document.querySelector('#langTabs .tab.active');
      const body=Q('#transBody');body.textContent=TRANSLATIONS[(act&&act.dataset.lang)||'en'];}
    // Trusted References — render the REAL citations returned by Foundry IQ.
    const rg=Q('#refsGrid'), rsub=Q('#refsSub');
    if(rg){
      if(Array.isArray(a.references)&&a.references.length){
        rg.innerHTML='';
        a.references.forEach(ref=>{
          const tag=((ref.title||'Source').replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase())||'SRC';
          const link=ref.url&&/^https?:\/\//.test(ref.url);
          const el=document.createElement(link?'a':'div');
          el.className='refitem';
          if(link){el.href=ref.url;el.target='_blank';el.rel='noopener noreferrer';}
          el.innerHTML='<span class="ref-ic" style="background:#0B6F86">'+esc(tag)+'</span>'+
            '<div><b>'+esc(ref.title||'Source')+'</b><small>'+esc(ref.snippet||ref.docKey||'Retrieved via Foundry IQ')+'</small></div>';
          rg.appendChild(el);
        });
        if(rsub)rsub.textContent='Research Agent · '+a.references.length+' source'+(a.references.length>1?'s':'')+' retrieved via Foundry IQ';
      } else if(a.grounded===false){
        rg.innerHTML='<div class="refitem"><span class="ref-ic" style="background:#9AA5B1">i</span>'+
          '<div><b>Live grounding unavailable for this run</b><small>Foundry IQ returned no sources — the summary relies on general medical knowledge. Citations are not shown rather than invented.</small></div></div>';
        if(rsub)rsub.textContent='Research Agent · Foundry IQ grounding unavailable this run';
      }
    }
  }
})();


/* ============ honesty: label simulated (offline) mode ============ */
/* When opened WITHOUT ?api=, the app runs on built-in sample data — no Azure or
   Foundry IQ calls are made. Make that explicit so the demo never over-claims. */
(function(){
  if(/[?&]api=/.test(location.search)||window.MEDICARE_API)return; // live mode handles its own badge
  addEventListener('load',()=>{
    const tb=document.querySelector('.tb-right');
    if(tb&&!tb.querySelector('.demo-badge')){
      const b=document.createElement('span');b.className='badge badge-amber demo-badge';
      b.title='Running on built-in sample data — open with ?api=<your-function-app> for live Azure + Foundry IQ';
      b.textContent='Demo · sample data';
      tb.prepend(b);
    }
    // Soften the simulated results banner so "grounded via Foundry IQ" isn't claimed offline.
    const bspan=document.querySelector('.res-banner span');
    if(bspan&&/Foundry IQ/.test(bspan.textContent))
      bspan.textContent='Simulated demo · sample data · educational, not diagnostic — connect Azure (?api=) for live Foundry IQ grounding';
    const refsSub=document.getElementById('refsSub');
    if(refsSub)refsSub.textContent='Sample references (illustrative) · live citations come from Foundry IQ in Azure mode';
    // Soften any "Foundry IQ grounded" badge so the simulated run doesn't claim real grounding.
    document.querySelectorAll('.badge').forEach(b=>{
      if(/Foundry IQ grounded/i.test(b.textContent)) b.textContent='Foundry IQ grounding (simulated)';
    });
    document.querySelectorAll('.res-banner span').forEach(s=>{
      if(/grounded via Foundry IQ/i.test(s.textContent))
        s.textContent='Simulated demo · sample data · educational, not diagnostic';
    });
  });
})();

/* ============ creative extras: dark mode · body map · read aloud ============ */
let darkOn=false;
function toggleDark(){
  darkOn=!darkOn;
  document.body.classList.toggle('dark',darkOn);
  const t=document.getElementById('darkToggle');
  if(t)t.setAttribute('aria-checked',darkOn?'true':'false');
}
const BODYMAP=[
  {key:'heart',flag:true,icon:'i-heart',title:'Heart & cholesterol',note:'LDL is mildly elevated (3.9). Usually improved with diet and exercise — worth a chat with your doctor.'},
  {key:'blood',flag:true,icon:'i-drop',title:'Blood & iron',note:'Hemoglobin is slightly low (11.2). Often linked to low iron — a ferritin test can confirm.'},
  {key:'kidneys',flag:false,icon:'i-kidney',title:'Kidneys',note:'eGFR 96 — filtering at a healthy rate. Nothing to do here.'},
  {key:'brain',flag:false,icon:'i-brain',title:'Metabolism & blood sugar',note:'HbA1c 5.4% — excellent 3-month blood sugar control. No sign of diabetes.'}
];
(function(){
  const list=document.getElementById('bmList');if(!list)return;
  function select(key){
    document.querySelectorAll('.bm-organ').forEach(o=>o.classList.toggle('sel',o.dataset.bm===key));
    document.querySelectorAll('.bm-item').forEach(i=>i.classList.toggle('sel',i.dataset.bm===key));
  }
  BODYMAP.forEach(b=>{
    const d=document.createElement('div');
    d.className='finding bm-item';d.dataset.bm=b.key;d.setAttribute('role','listitem');d.tabIndex=0;
    d.innerHTML='<span class="fi-ic" style="background:'+(b.flag?'rgba(255,185,0,.15)':'rgba(22,198,12,.12)')+';color:'+(b.flag?'var(--warning-dark)':'var(--success-dark)')+'"><svg><use href="#'+b.icon+'"/></svg></span><div><b>'+b.title+' '+(b.flag?'<span class="badge badge-amber" style="padding:2px 9px;font-size:10.5px">Worth discussing</span>':'<span class="badge badge-green" style="padding:2px 9px;font-size:10.5px">All good</span>')+'</b><small>'+b.note+'</small></div>';
    d.onclick=()=>select(b.key);
    d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(b.key)}};
    list.appendChild(d);
  });
  document.querySelectorAll('.bm-organ').forEach(o=>{
    const b=BODYMAP.find(x=>x.key===o.dataset.bm);
    if(b&&b.flag)o.classList.add('flag');
    o.addEventListener('click',()=>{select(o.dataset.bm);
      const row=document.querySelector('.bm-item[data-bm="'+o.dataset.bm+'"]');
      row&&row.scrollIntoView({behavior:'smooth',block:'nearest'})});
  });
})();
let speaking=false;
function speakSummary(){
  if(!('speechSynthesis'in window)){toast('Read-aloud is not supported in this browser');return}
  if(speaking){speechSynthesis.cancel();speaking=false;return}
  const act=document.querySelector('#langTabs .tab.active');
  const lang={en:'en-US',ms:'ms-MY',zh:'zh-CN',ja:'ja-JP'}[(act&&act.dataset.lang)||'en'];
  const u=new SpeechSynthesisUtterance(document.getElementById('transBody').textContent);
  u.lang=lang;u.rate=.98;
  u.onend=()=>{speaking=false};
  speaking=true;speechSynthesis.speak(u);
  toast('Reading aloud ('+lang+') — tap again to stop');
}

/* ============ auto demo tour — open with ?autodemo ============ */
(function(){
  if(!/[?&]autodemo/.test(location.search))return;
  const cur=document.createElement('div');
  cur.style.cssText='position:fixed;left:0;top:0;width:22px;height:22px;border-radius:50%;background:rgba(0,120,212,.92);border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,40,90,.45);z-index:9999;pointer-events:none;transform:translate(-50%,-50%);transition:opacity .5s,transform .14s;opacity:0';
  document.body.appendChild(cur);
  let cx=innerWidth/2,cy=innerHeight*.6;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setPos=(x,y)=>{cx=x;cy=y;cur.style.left=x+'px';cur.style.top=y+'px'};
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const move=(x,y,d=900)=>new Promise(res=>{const sx=cx,sy=cy,t0=performance.now();
    (function f(t){const p=Math.min(1,(t-t0)/d),e=ease(p);
      setPos(sx+(x-sx)*e+Math.sin(p*7)*(1-p)*6,sy+(y-sy)*e+Math.cos(p*5)*(1-p)*4);
      p<1?requestAnimationFrame(f):res()})(t0)});
  async function clickEl(el,d=900){if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});await sleep(750);
    const r=el.getBoundingClientRect();await move(r.left+r.width/2+(Math.random()*8-4),r.top+r.height/2+(Math.random()*6-3),d);
    await sleep(300);cur.style.transform='translate(-50%,-50%) scale(.7)';await sleep(140);
    cur.style.transform='translate(-50%,-50%) scale(1)';el.click();await sleep(480)}
  async function drift(px,wait=1400){window.scrollBy({top:px,behavior:'smooth'});await sleep(wait)}
  async function tour(){
    await sleep(1600);cur.style.opacity=1;setPos(innerWidth*.62,innerHeight*.55);
    const upBtn=document.querySelector('.hero-actions .btn-primary');
    if(upBtn){const r=upBtn.getBoundingClientRect();await move(r.left+r.width/2,r.top+r.height/2,1300);await sleep(900)}
    await drift(innerHeight*.85);await drift(innerHeight*.85);
    await drift(innerHeight*.9,1500);
    window.scrollTo({top:0,behavior:'smooth'});await sleep(1400);
    await clickEl(document.querySelector('.hero-actions .btn-secondary'),1100);
    for(let i=0;i<5;i++){const w=document.querySelector('.pl-step.working');
      if(w){const r=w.getBoundingClientRect();await move(innerWidth*.5+110,Math.min(Math.max(r.top+19,150),innerHeight-130),900)}
      await sleep(1800)}
    await sleep(3600);
    await sleep(1200);await drift(innerHeight*.7);
    await clickEl(document.querySelector('.term-chip'));await sleep(1700);
    await clickEl(document.querySelector('[data-lang="zh"]'));await sleep(1900);
    await drift(innerHeight*.7,1300);
    await clickEl(document.querySelector('.sb-item[data-view="agents"]'));await sleep(1900);
    await drift(innerHeight*.6,1700);
    await clickEl(document.querySelector('.sb-item[data-view="history"]'));await sleep(2300);
    await clickEl(document.querySelector('.sb-item[data-view="dashboard"]'));await sleep(900);
    const rt=[...document.querySelectorAll('#results h3')].find(h=>h.textContent==='Reasoning Trace');
    if(rt)rt.scrollIntoView({behavior:'smooth',block:'start'});await sleep(2800);
    await drift(innerHeight*.85,2200);
    cur.style.opacity=0;
  }
  if(document.readyState==='complete')tour();else addEventListener('load',tour);
})();
