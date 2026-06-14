const { app } = require('@azure/functions');

// Azure AI Document Intelligence - prebuilt-read (OCR for PDF/PNG/JPEG/DOCX)
app.http('extract', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    try {
      const { base64 } = await req.json();
      if (!base64) return { status: 400, jsonBody: { error: 'Provide base64 file content.' } };
      if (base64.length > 35_000_000) return { status: 413, jsonBody: { error: 'File too large (max ~25 MB).' } };
      const ep = process.env.DOCINTEL_ENDPOINT;
      const start = await fetch(`${ep}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': process.env.DOCINTEL_KEY },
        body: JSON.stringify({ base64Source: base64 })
      });
      if (start.status !== 202) return { status: 502, jsonBody: { error: 'Document Intelligence error', detail: await start.text() } };
      const op = start.headers.get('operation-location');
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const poll = await fetch(op, { headers: { 'Ocp-Apim-Subscription-Key': process.env.DOCINTEL_KEY } });
        const j = await poll.json();
        if (j.status === 'succeeded') return { jsonBody: { text: j.analyzeResult.content } };
        if (j.status === 'failed') return { status: 502, jsonBody: { error: 'OCR failed' } };
      }
      return { status: 504, jsonBody: { error: 'OCR timeout' } };
    } catch (e) {
      ctx.error(e);
      return { status: 500, jsonBody: { error: String(e.message || e) } };
    }
  }
});
