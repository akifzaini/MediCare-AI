const { app } = require('@azure/functions');
const { retrieve, isConfigured } = require('./_foundryiq');

// POST /api/retrieve  { query }
// Standalone Foundry IQ knowledge-retrieval endpoint. Returns grounded passages
// and the real references[] (cited sources) from the knowledge base.
app.http('retrieve', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    try {
      const { query } = await req.json();
      if (!query || String(query).length < 3) {
        return { status: 400, jsonBody: { error: 'Provide a query (min 3 chars).' } };
      }
      if (!isConfigured()) {
        return { status: 501, jsonBody: { error: 'Foundry IQ not configured. Set FOUNDRY_IQ_ENDPOINT, FOUNDRY_IQ_KEY and FOUNDRY_IQ_KB.' } };
      }
      const g = await retrieve(query, ctx);
      return { jsonBody: g };
    } catch (e) {
      ctx.error(e);
      return { status: 500, jsonBody: { error: String(e.message || e) } };
    }
  }
});
