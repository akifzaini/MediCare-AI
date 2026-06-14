// Verifies the REAL Foundry IQ integration: retrieve() parses the knowledge-base
// response, and analyze() grounds on it + returns real references[].
const errors=[]; const t=async(n,f)=>{try{await f();console.log('PASS',n)}catch(e){errors.push(n+': '+e.message);console.log('FAIL',n,e.message)}};

// Sample shape from the Foundry IQ retrieve action (Azure AI Search knowledge base).
const KB_RESPONSE={
  response:[{role:'assistant',content:[{type:'text',text:JSON.stringify([
    {ref_id:0,title:'Anaemia in adults',terms:'haemoglobin thresholds',content:'WHO: Hb 11.0-12.9 g/dL is mild anaemia in adults.'},
    {ref_id:1,title:'Blood cholesterol',terms:'LDL',content:'NIH: elevated LDL is improved with diet and exercise.'}
  ])}]}],
  references:[
    {type:'AzureSearchDoc',id:'0',docKey:'who_anaemia',sourceData:{title:'Anaemia in adults',content:'WHO: Hb 11.0-12.9 g/dL is mild anaemia.',url:'https://www.who.int/anaemia'}},
    {type:'AzureSearchDoc',id:'1',docKey:'nih_chol',sourceData:{title:'Blood cholesterol',content:'NIH: elevated LDL improved with diet.',url:'https://medlineplus.gov/cholesterol'}}
  ]
};

(async()=>{
  // ---- retrieve() unit ----
  process.env.FOUNDRY_IQ_ENDPOINT='https://medicare-search.search.windows.net';
  process.env.FOUNDRY_IQ_KEY='k'; process.env.FOUNDRY_IQ_KB='medicare-knowledge';
  delete require.cache[require.resolve('../azure-backend/src/functions/_foundryiq.js')];
  const { retrieve, isConfigured } = require('../azure-backend/src/functions/_foundryiq.js');
  let calledUrl='';
  global.fetch=async(url,o)=>{ calledUrl=url; return { ok:true, status:200, json:async()=>KB_RESPONSE }; };
  await t('isConfigured true when env set',()=>{ if(!isConfigured())throw Error('not configured'); });
  const g=await retrieve('Explain Hb 11.2 and LDL 3.9',{error(){}});
  await t('retrieve hits knowledgebases/.../retrieve endpoint',()=>{ if(!/\/knowledgebases\/medicare-knowledge\/retrieve\?api-version=/.test(calledUrl))throw Error(calledUrl); });
  await t('retrieve grounded=true',()=>{ if(!g.grounded)throw Error('not grounded'); });
  await t('retrieve returns 2 real references',()=>{ if(g.references.length!==2)throw Error('got '+g.references.length); });
  await t('references carry title + url',()=>{ if(g.references[0].title!=='Anaemia in adults'||!g.references[0].url.startsWith('http'))throw Error(JSON.stringify(g.references[0])); });

  // ---- analyze() integration: grounds + surfaces references ----
  process.env.AZURE_OPENAI_ENDPOINT='https://oai.example'; process.env.AZURE_OPENAI_KEY='k'; process.env.AZURE_OPENAI_DEPLOYMENT='gpt-4o-mini';
  const mock=require('@azure/functions');
  delete require.cache[require.resolve('../azure-backend/src/functions/analyze.js')];
  require('../azure-backend/src/functions/analyze.js');
  const analyze=mock.__handlers.analyze;
  let sawGroundingBlock=false;
  global.fetch=async(url,o)=>{
    if(/\/knowledgebases\//.test(url)) return { ok:true,status:200,json:async()=>KB_RESPONSE };
    // OpenAI call — confirm grounding sources were injected into the prompt
    const body=JSON.parse(o.body); const userMsg=body.messages[1].content;
    if(/GROUNDING SOURCES/.test(userMsg)) sawGroundingBlock=true;
    return { ok:true, json:async()=>({choices:[{message:{content:JSON.stringify({summary:'ok',findings:[],terms:[],questions:[],trace:[],translations:{}})}}]}) };
  };
  const res=await analyze({json:async()=>({text:'Hemoglobin 11.2 g/dL below range. LDL 3.9 mmol/L.'})},{error(){}});
  await t('analyze injected Foundry IQ grounding into prompt',()=>{ if(!sawGroundingBlock)throw Error('no grounding block in prompt'); });
  await t('analyze surfaces grounded=true',()=>{ if(res.jsonBody.grounded!==true)throw Error('grounded='+res.jsonBody.grounded); });
  await t('analyze returns real references[]',()=>{ if(!Array.isArray(res.jsonBody.references)||res.jsonBody.references.length!==2)throw Error(JSON.stringify(res.jsonBody.references)); });

  // ---- honest fallback when Foundry IQ NOT configured ----
  delete process.env.FOUNDRY_IQ_ENDPOINT; delete process.env.FOUNDRY_IQ_KEY; delete process.env.FOUNDRY_IQ_KB;
  delete require.cache[require.resolve('../azure-backend/src/functions/_foundryiq.js')];
  delete require.cache[require.resolve('../azure-backend/src/functions/analyze.js')];
  require('../azure-backend/src/functions/analyze.js'); const analyze2=mock.__handlers.analyze;
  let groundedCallMade=false;
  global.fetch=async(url,o)=>{ if(/\/knowledgebases\//.test(url))groundedCallMade=true; return { ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'ok',findings:[],terms:[],questions:[],trace:[],translations:{}})}}]}) }; };
  const res2=await analyze2({json:async()=>({text:'Hemoglobin 11.2 g/dL below range.'})},{error(){}});
  await t('no Foundry IQ call when unconfigured',()=>{ if(groundedCallMade)throw Error('called KB when unconfigured'); });
  await t('honest fallback grounded=false + empty references',()=>{ if(res2.jsonBody.grounded!==false||res2.jsonBody.references.length!==0)throw Error(JSON.stringify({g:res2.jsonBody.grounded,r:res2.jsonBody.references})); });

  console.log('\n=== FOUNDRY-IQ RESULT:',errors.length?('FAILURES '+JSON.stringify(errors)):'ALL PASSED ===');
  process.exit(errors.length?1:0);
})();
