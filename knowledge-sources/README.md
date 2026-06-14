# Knowledge sources (Foundry IQ)

These trusted reference documents are indexed by the **Foundry IQ knowledge base**
(`medicare-knowledge`, on Azure AI Search) and are what make MediCare AI's citations
grounded rather than model-invented.

| File | Topic | Primary source |
|------|-------|----------------|
| who-anaemia-haemoglobin.md | Haemoglobin / anaemia thresholds | World Health Organization |
| cholesterol-ldl.md | LDL cholesterol ranges | NIH MedlinePlus / NCEP |
| hba1c-diabetes.md | HbA1c & diabetes screening | ADA / WHO |
| egfr-kidney-function.md | eGFR / kidney function | KDIGO / NKF |
| moh-health-screening.md | Adult health screening | Ministry of Health Malaysia |

Flow: uploaded to a Blob container (`refs`) → indexed into `medicare-index` (with a semantic
configuration) → wrapped by knowledge base `medicare-knowledge` (source `medicare-sources-ks`) →
the backend `analyze` function calls its `retrieve` action so cited passages ground the output.
Full steps: ../CONNECT-FOUNDRY-IQ.md
