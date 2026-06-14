// ============================================================================
// Foundry IQ grounding helper  (shared by analyze.js and retrieve.js)
// ----------------------------------------------------------------------------
// Calls a Microsoft Foundry IQ knowledge base's `retrieve` action — the real
// agentic knowledge-retrieval engine behind Foundry IQ — and returns grounded,
// cited source passages. This is what makes the Research Agent's citations
// REAL (retrieved from a knowledge base) instead of model-invented.
//
// Endpoint (Azure AI Search knowledge base, the engine Foundry IQ runs on):
//   POST {endpoint}/knowledgebases/{kb}/retrieve?api-version=2025-11-01-preview
// Docs: https://learn.microsoft.com/azure/search/agentic-retrieval-how-to-retrieve
//
// Configure via app settings:
//   FOUNDRY_IQ_ENDPOINT      https://<your-search>.search.windows.net
//   FOUNDRY_IQ_KEY           query or admin key for the search service
//   FOUNDRY_IQ_KB            knowledge base name
//   FOUNDRY_IQ_SOURCE        (optional) knowledge source name to scope to
//   FOUNDRY_IQ_API_VERSION   (optional) defaults to 2025-11-01-preview
//
// If these are NOT set, retrieval is skipped and { grounded:false } is returned
// so the rest of the app degrades gracefully and stays HONEST about it.
// ============================================================================

const GROUND_SYS =
  'You ground a medical report explainer. Sources are returned as JSON objects, ' +
  'each with a ref_id that must be cited. Only surface trustworthy clinical ' +
  'reference material (e.g. WHO, NIH, MOH, peer-reviewed guidelines).';

function isConfigured() {
  return !!(process.env.FOUNDRY_IQ_ENDPOINT && process.env.FOUNDRY_IQ_KEY && process.env.FOUNDRY_IQ_KB);
}

// Turn the raw references[] + grounding string into frontend-friendly citations.
// We do NOT fabricate confidence scores — the retrieve action does not expose a
// per-reference score, so we return only what the knowledge base actually gives.
function normalizeRefs(refs, grounding) {
  let chunks = [];
  try { chunks = JSON.parse((grounding || '').trim() || '[]'); } catch { chunks = []; }
  const byId = {};
  chunks.forEach(c => { if (c && c.ref_id != null) byId[String(c.ref_id)] = c; });

  const out = [];
  (refs || []).forEach((ref, i) => {
    const sd = ref.sourceData || byId[String(ref.id)] || {};
    const title = sd.title || sd.name || ('Source ' + (ref.id != null ? ref.id : i + 1));
    const snippet = String(sd.content || sd.terms || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const url = sd.url || sd.source || sd.path || sd.filepath || '';
    out.push({
      id: String(ref.id != null ? ref.id : i),
      title: String(title).slice(0, 140),
      snippet,
      url: String(url),
      docKey: ref.docKey || ''
    });
  });

  const seen = new Set();
  return out.filter(r => {
    const k = r.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);
}

// Query the knowledge base. Returns { grounded, grounding, references, error? }.
async function retrieve(query, ctx) {
  if (!isConfigured()) return { grounded: false, grounding: '', references: [] };

  const endpoint = process.env.FOUNDRY_IQ_ENDPOINT.replace(/\/+$/, '');
  const kb = encodeURIComponent(process.env.FOUNDRY_IQ_KB);
  const ver = process.env.FOUNDRY_IQ_API_VERSION || '2025-11-01-preview';
  const url = `${endpoint}/knowledgebases/${kb}/retrieve?api-version=${ver}`;

  const body = {
    messages: [
      { role: 'assistant', content: [{ type: 'text', text: GROUND_SYS }] },
      { role: 'user', content: [{ type: 'text', text: String(query).slice(0, 4000) }] }
    ]
  };
  if (process.env.FOUNDRY_IQ_SOURCE) {
    body.knowledgeSourceParams = [{
      knowledgeSourceName: process.env.FOUNDRY_IQ_SOURCE,
      kind: 'searchIndex',
      includeReferences: true,
      includeReferenceSourceData: true
    }];
  }

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.FOUNDRY_IQ_KEY },
    body: JSON.stringify(body)
  });

  // 200 = full success, 206 = partial (some sources failed) — both usable.
  if (!r.ok && r.status !== 206) {
    const detail = await r.text().catch(() => '');
    if (ctx && ctx.error) ctx.error('Foundry IQ retrieve failed ' + r.status + ': ' + detail);
    return { grounded: false, grounding: '', references: [], error: 'Foundry IQ retrieve HTTP ' + r.status };
  }

  const data = await r.json();
  const grounding = (((data.response || [])[0] || {}).content || [])
    .map(c => c && c.text).filter(Boolean).join('\n');
  const references = normalizeRefs(data.references, grounding);

  return { grounded: references.length > 0 || grounding.length > 0, grounding, references };
}

module.exports = { retrieve, isConfigured, normalizeRefs };
