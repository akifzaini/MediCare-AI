# Connecting Foundry IQ (for real) — MediCare AI

"Foundry IQ" runs on **Azure AI Search knowledge bases** (agentic retrieval). Connecting it:
create a Search service → index your reference docs → create a knowledge base → put the
endpoint/key/names in the backend settings.

## 0. Prerequisites
- Azure for Students ($100 credit): https://azure.microsoft.com/free/students
- Azure CLI + Functions Core Tools
- Agentic retrieval needs the **semantic ranker** → **Basic** tier (Free tier can't do it).
  Basic ≈ a few dollars of credit for a few days; delete the resource group when done.

## 1. Azure AI Search service (the Foundry IQ engine)
Portal → Create resource → "Azure AI Search" → resource group `medicare-rg`, region
**Southeast Asia** (or your student-allowed region), tier **Basic**.
Copy the **Url** (`https://<name>.search.windows.net`) and a **key** (Settings → Keys).

## 2. Reference documents
Create a Storage account → container `refs` → upload the files in `knowledge-sources/`.

## 3. Index + knowledge base
- Import the `refs` blobs into an index `medicare-index`; add a **semantic configuration**
  (content field = `content`).
- Create a knowledge base `medicare-knowledge` over it (knowledge source `medicare-sources-ks`).
- **Reasoning effort: Minimal** — Low/Medium/High require an Azure OpenAI deployment; Minimal
  needs no model and still returns real cited sources (which is all MediCare AI needs).

This project's actual setup: service `medicare-search-kiff`, index `medicare-index`
(semantic config `medicare-semantic`), knowledge source `medicare-sources-ks`, knowledge base
`medicare-knowledge`, reasoning effort Minimal.

## 4. Connect the app
In `azure-backend/local.settings.json` (git-ignored) or the Function App settings:
```
FOUNDRY_IQ_ENDPOINT=https://medicare-search-kiff.search.windows.net
FOUNDRY_IQ_KEY=<search key>
FOUNDRY_IQ_KB=medicare-knowledge
FOUNDRY_IQ_SOURCE=medicare-sources-ks
FOUNDRY_IQ_API_VERSION=2025-11-01-preview
```

## 5. Verify
Upload a report in live mode → `grounded:true`, real Trusted References, trace cites sources.
Or: `POST {endpoint}/knowledgebases/medicare-knowledge/retrieve?api-version=2025-11-01-preview`.

## 6. Clean up
`az group delete -n medicare-rg --yes --no-wait`

> Keys never go in the repo — only in local.settings.json (git-ignored) or Function App settings.
