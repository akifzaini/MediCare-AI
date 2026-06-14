const { app } = require('@azure/functions');
const { retrieve } = require('./_foundryiq');

const SYSTEM = `You are MediCare AI, a medical report explainer. You NEVER diagnose.
You explain findings in warm plain English a layperson understands.
Return STRICT JSON with keys:
summary (string, 3-5 sentences, plain English),
findings (array of {label, value, status: "normal"|"low"|"high"|"attention", note}),
terms (array of {term, explain} for medical terms found, max 8),
questions (array of 5 short questions the patient should ask their doctor),
trace (array of 5 {title, note} reasoning steps: Observe, Hypothesize, Retrieve, Cross-check, Conclude),
translations (object with keys ms, zh, ja - the summary translated to Bahasa Melayu, Simplified Chinese, Japanese).
GROUNDING: If a "GROUNDING SOURCES" block is provided, base every clinical/threshold
claim on it and cite the matching ref_id in the "Retrieve" trace step (e.g. "per source [0]").
If no grounding block is provided, state in the "Retrieve" step that live Foundry IQ
grounding was unavailable for this run and you relied on general medical knowledge.
Never invent citations.
Never use diagnostic language ("you have X"). Use "may indicate", "worth discussing".`;

app.http('analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    try {
      const { text } = await req.json();
      if (!text || text.length < 20) return { status: 400, jsonBody: { error: 'Provide extracted report text (min 20 chars).' } };

      // 1) Research Agent — REAL Foundry IQ knowledge retrieval (grounding).
      //    Skipped gracefully if Foundry IQ env vars are not configured.
      let grounding = { grounded: false, grounding: '', references: [] };
      try {
        grounding = await retrieve(
          'Verify and explain the clinical findings and reference ranges in this medical report:\n' + text.slice(0, 1500),
          ctx
        );
      } catch (gErr) {
        ctx.error('Foundry IQ retrieval skipped: ' + (gErr.message || gErr));
        grounding = { grounded: false, grounding: '', references: [], error: String(gErr.message || gErr) };
      }
      const groundingBlock = grounding.grounded
        ? '\n\nGROUNDING SOURCES (retrieved via Foundry IQ — base clinical claims on these and cite ref_id in the Retrieve step):\n' + grounding.grounding
        : '';

      // 2) Reasoning + the rest of the agent team — Azure OpenAI.
      const url = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-08-01-preview`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY },
        body: JSON.stringify({
          response_format: { type: 'json_object' },
          temperature: 0.3,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: 'Medical report text:\n\n' + text.slice(0, 12000) + groundingBlock }
          ]
        })
      });
      if (!r.ok) return { status: 502, jsonBody: { error: 'Azure OpenAI error', detail: await r.text() } };
      const data = await r.json();
      const out = JSON.parse(data.choices[0].message.content);

      // Surface the REAL retrieval result to the frontend.
      out.grounded = grounding.grounded;
      out.references = grounding.references;
      if (grounding.error) out.groundingError = grounding.error;
      out.disclaimer = 'MediCare AI does not diagnose disease. Always consult a qualified healthcare professional.';
      return { jsonBody: out };
    } catch (e) {
      ctx.error(e);
      return { status: 500, jsonBody: { error: String(e.message || e) } };
    }
  }
});
