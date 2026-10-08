---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/documents","src/pages/certificates"]
---

# Surface brief: Garabato app (home + signing flow)

Scope: whole authenticated app world (home, documents, document detail, certificates); admin/config inherit tokens. Mode: Operate.

Audience/job: one person signing their own PDFs with stored digital certificates (FNMT-style). Task: drop a PDF, place the visible stamp, sign, download. They do not care about pending/recent panels; they care about getting from file to signed PDF fast and knowing which certificate will sign.

Constraints: keep every existing colour token and accent usage exactly (user-pinned); keep the Garabato name, the one-stroke signature logo, terracotta accent, light + dark + system themes. Crons hidden from nav, search and home (routes and backend untouched).

Unresolved: none.

## Direction contract

THESIS: Garabato is a blank sheet and a pen: one sheet to drop a PDF on, and a signature that writes itself. Refuses the category default of grey dashboards with stat tiles and pending queues.

OWN-WORLD: the incumbent palette is pinned by the user (paper, ink, mute, hairlines, Brand Terracotta and its existing uses, the existing dark theme) and must not change; the world speaks through type, near-square corners, the PDF sheet on a desk tint and the rubric. Schibsted Grotesk for UI, JetBrains Mono for serials, fingerprints and sizes. Near-square corners (4px base). PDF pages sit as white sheets with a soft paper shadow on a faint desk tint.

STORY: the visitor lands, sees one large drop target that says what Garabato does, sees which certificate will sign, drops a PDF and lands on the document with signing open.

FIRST VIEWPORT: navbar (logo, Documentos, Certificados, user). Main: left two-thirds a tall dashed sheet-shaped drop zone ("Suelta un PDF para firmarlo", "Elegir archivo" button), the rubric stroke drawing itself once above the headline; right third: "Firmarás con" list of certificates (holder, issuer, expiry, default marker) with import link, then a link to the full document library.

FORM: "Hoja en blanco", grounded candidate from the safer re-roll (user pick), seed key 1f01f4eb. Signature move: the logo's rubric draws stroke by stroke on the home sheet and when a signature completes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
