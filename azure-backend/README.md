# MediCare AI — Live Azure Backend

Three Azure Functions that turn the demo into a real Azure AI product:

| Endpoint | Service | What it does |
|---|---|---|
| `POST /api/extract` | Azure AI Document Intelligence | OCR — PDF/PNG/JPEG → text |
| `POST /api/retrieve` | **Foundry IQ** (Azure AI Search knowledge base) | Agentic knowledge retrieval — returns cited, grounded source passages |
| `POST /api/analyze` | Azure OpenAI (gpt-4o-mini) + **Foundry IQ** | Calls Foundry IQ to ground the report, then produces summary, findings, terms, questions, reasoning trace, real `references[]` + MS/ZH/JA translations |

### Foundry IQ grounding (the required Microsoft IQ layer)

`analyze` first calls the Research Agent's Foundry IQ knowledge base via the
[`retrieve` action](https://learn.microsoft.com/azure/search/agentic-retrieval-how-to-retrieve)
(`POST {endpoint}/knowledgebases/{kb}/retrieve?api-version=2025-11-01-preview`). The
retrieved, cited passages are injected into the model prompt as grounding, and the
real `references[]` are returned to the UI — so citations come from a knowledge base,
not the model. If the `FOUNDRY_IQ_*` settings are absent, retrieval is skipped and the
response is flagged `grounded:false` (honest fallback, no fake citations).

Set up a knowledge base ([guide](https://learn.microsoft.com/azure/search/agentic-retrieval-how-to-create-knowledge-base))
over your WHO / NIH / MOH reference documents, then add the `FOUNDRY_IQ_*` app settings below.

## Deploy with your Azure for Students account (~10 min)

Prereqs: [Azure CLI](https://aka.ms/azcli) + [Functions Core Tools](https://aka.ms/functions-core-tools), then:

```bash
az login                                   # sign in with your UTM live account
az group create -n medicare-rg -l southeastasia

# 1. Azure OpenAI + model deployment
az cognitiveservices account create -n medicare-openai -g medicare-rg \
  -l southeastasia --kind OpenAI --sku S0
az cognitiveservices account deployment create -n medicare-openai -g medicare-rg \
  --deployment-name gpt-4o-mini --model-name gpt-4o-mini \
  --model-version "2024-07-18" --model-format OpenAI --sku-capacity 8 --sku-name GlobalStandard

# 2. Document Intelligence (free tier F0)
az cognitiveservices account create -n medicare-docintel -g medicare-rg \
  -l southeastasia --kind FormRecognizer --sku F0

# 3. Azure AI Search — the engine behind Foundry IQ (Basic tier or free dev tier)
az search service create -n medicare-search -g medicare-rg -l southeastasia --sku basic
# then create a knowledge base + knowledge source over your WHO/NIH/MOH docs:
# https://learn.microsoft.com/azure/search/agentic-retrieval-how-to-create-knowledge-base

# 4. Function App (consumption = free grant)
az storage account create -n medicarestor$RANDOM -g medicare-rg -l southeastasia --sku Standard_LRS
az functionapp create -n medicare-api-<yourname> -g medicare-rg \
  --consumption-plan-location southeastasia --runtime node --runtime-version 20 \
  --functions-version 4 --storage-account <storage-name-from-above>

# 5. Settings (get keys: az cognitiveservices account keys list -n <name> -g medicare-rg)
az functionapp config appsettings set -n medicare-api-<yourname> -g medicare-rg --settings \
  AZURE_OPENAI_ENDPOINT=https://medicare-openai.openai.azure.com \
  AZURE_OPENAI_KEY=<key> AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini \
  DOCINTEL_ENDPOINT=https://medicare-docintel.cognitiveservices.azure.com \
  DOCINTEL_KEY=<key> \
  FOUNDRY_IQ_ENDPOINT=https://medicare-search.search.windows.net \
  FOUNDRY_IQ_KEY=<search-key> FOUNDRY_IQ_KB=medicare-knowledge \
  FOUNDRY_IQ_SOURCE=medicare-sources-ks FOUNDRY_IQ_API_VERSION=2025-11-01-preview
az functionapp cors add -n medicare-api-<yourname> -g medicare-rg --allowed-origins "*"

# 6. Publish
cd azure-backend && npm install && func azure functionapp publish medicare-api-<yourname>
```

## Connect the frontend

Open the app with your API URL:

```
index.html?api=https://medicare-api-<yourname>.azurewebsites.net
```

The app auto-switches from simulated to **LIVE mode**: uploads are OCR'd by
Document Intelligence, grounded via Foundry IQ knowledge retrieval, and analyzed
by Azure OpenAI — summary, findings, term chips, doctor questions, reasoning
trace, cited references and translations all become real. If the API is
unreachable, the app falls back to the simulated demo with an elegant
"Azure unavailable" error state.

## Local test

```bash
cd azure-backend && npm install
cp local.settings.sample.json local.settings.json   # fill in your keys
func start
# then open index.html?api=http://localhost:7071
```

## Security notes
- Endpoints are `authLevel: anonymous` + CORS `*` for easy hackathon demoing.
  For production: switch to `authLevel: function` (key in query/header) and
  restrict CORS to your domain.
- `/api/extract` caps payloads at ~25 MB (HTTP 413).
- User report text is sent ONLY in the user role; the system prompt (which
  forbids diagnostic language) cannot be overridden by report content.

## Notes
- Keys live ONLY in Function App settings — never in the frontend or repo.
- Azure OpenAI access on student subscriptions varies by region; if blocked,
  create the deployment via Microsoft Foundry portal (ai.azure.com) instead.
- Foundry IQ retrieval is optional at runtime: if `FOUNDRY_IQ_*` is unset,
  `analyze` skips grounding and returns `grounded:false` (no fabricated citations).
- Free grants: Document Intelligence F0 = 500 pages/mo; Functions = 1M execs/mo.
