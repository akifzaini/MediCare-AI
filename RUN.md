# Running MediCare AI — full system with Foundry IQ connected

Live app = frontend + 3 Azure Functions + 3 Azure services.

| Service | Powers | Env vars | Status |
|---|---|---|---|
| Foundry IQ (Azure AI Search knowledge base) | grounding in `analyze`/`retrieve` | `FOUNDRY_IQ_*` | connected |
| Azure OpenAI (`gpt-4o-mini`) | summary, reasoning, translations | `AZURE_OPENAI_*` | create |
| Document Intelligence | OCR of the uploaded report | `DOCINTEL_*` | create |

## 1. Create the two missing services (Azure for Students)
```bash
az login
az cognitiveservices account create -n medicare-openai -g medicare-rg -l southeastasia --kind OpenAI --sku S0
az cognitiveservices account deployment create -n medicare-openai -g medicare-rg \
  --deployment-name gpt-4o-mini --model-name gpt-4o-mini --model-version "2024-07-18" \
  --model-format OpenAI --sku-capacity 8 --sku-name GlobalStandard
az cognitiveservices account create -n medicare-docintel -g medicare-rg -l southeastasia --kind FormRecognizer --sku F0
```
If `southeastasia` is blocked by the student region policy, use your allowed region. Azure OpenAI
on student accounts may need approval / a specific region — if blocked, deploy `gpt-4o-mini` via
the Microsoft Foundry portal (ai.azure.com).

## 2. Fill settings
Put endpoints/keys into `azure-backend/local.settings.json` (git-ignored; Foundry IQ already there):
AZURE_OPENAI_*, DOCINTEL_*.

## 3. Run locally
```bash
cd azure-backend
npm install
func start          # http://localhost:7071
```
Open `index.html?api=http://localhost:7071`, upload `samples/sample-lab-report.pdf`.

## 4. Connected = the analyze response shows `grounded: true` + a real `references` array,
the Trusted References cards show your sources, and the reasoning trace cites them.

### Foundry-IQ-only test (no upload)
```bash
curl -X POST http://localhost:7071/api/retrieve -H "Content-Type: application/json" \
  -d "{\"query\":\"What is the WHO haemoglobin threshold for anaemia?\"}"
```

## 5. Deploy (optional)
`func azure functionapp publish <app>`; set the same env vars in the Function App
(portal → Settings → Environment variables); open `index.html?api=https://<app>.azurewebsites.net`.
