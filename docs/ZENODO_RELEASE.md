# Zenodo release checklist (IMS Atlas v1.0.0)

Do **not** invent DOIs. After deposits exist, paste them into `CITATION.cff`,
`.zenodo.json`, cite placeholders in the app, and this file.

## A. Software record (this GitHub repo)

1. On [Zenodo](https://zenodo.org): enable GitHub integration for
   `cesar-andress/ims-atlas` (Account → GitHub → enable repository).
2. On GitHub: create a **Release** tagged `v1.0.0` from the release commit
   (annotated tag on `main`). Zenodo will mint a software DOI for that release.
3. Confirm `.zenodo.json` metadata (upload_type `software`, creators, MIT,
   related identifier → ims-backtest) matches the deposit landing page.
4. Record the software DOI (concept + version) and update:
   - `CITATION.cff` (`identifiers` / `doi`)
   - App cite placeholders (`SOFTWARE_DOI` in `app/src/cite/citations.ts`)

## B. Dataset record (separate Zenodo upload)

1. Create a **new** Zenodo deposit (do not reuse the software record).
2. Upload the contents of `data/release/public/v1.0.0/` (parquet + `manifest.json`
   + `catalog.json` + `LICENSES.md` + `README.md`). Build/promote locally first:
   ```bash
   cd etl && uv run atlas-etl release --version 1.0.0
   cd etl && uv run atlas-etl promote 1.0.0 --by "Your Name"
   ```
3. Paste metadata from `.zenodo.dataset.json` (title, creators, related identifiers
   to ims-atlas and ims-backtest, licence notes).
4. Publish; record the **data DOI** and update app `DATA_DOI` + README.

## C. After both DOIs exist

1. Replace `DOI-PENDING-*` strings in the cite view.
2. Optionally add both DOIs under `related_identifiers` cross-links.
3. Mention DOIs in the software paper (P2) Data/Code availability.
