# IMSFE workbook: Tablas vs Standardization (Phase J §7b)

Workbook (local only, never committed):
`../old_submission/a. Technique IMSFE FOOTWEAR 2025 10 score Shoes - Baena & Cano.xlsx`

## Finding

For Switzerland, a naïve weighted sum of the six criterion scores on sheet
**Tablas** (row 6, columns C–H) with the mean criterion weights (row 5) yields
**≈ 6.282**, while the sheet’s **IMSFEF Score** (I6) is **≈ 6.1193**.

The authoritative formula lives on sheet **3. Standardization of criteria**,
column **AC** (Overall Score), e.g. for Switzerland (after-standardization row 54):

```text
AC54 = $H$36*H54 + $L$36*L54 + $P$36*P54 + $T$36*T54 + $X$36*X54 + $AB$36*AB54
```

That evaluates to **6.119334270875329**, matching Tablas I6 and the prompt’s
Switzerland reference (6.1193).

## Cause

Criterion scores on **Tablas** match Standardization for COST, LOGI, COMM, ECON
and POLI. The **CULT** column on Tablas does **not**:

| Source | CULT (Switzerland) |
|--------|--------------------:|
| Standardization AB54 | 6.195422796849458 |
| Tablas H6 | 7.51554961113588 |

Difference ≈ 1.320 × CULT weight 0.12333 ≈ 0.163, which equals 6.282 − 6.119.

So Tablas column H (Culture) is **stale / inconsistent** with the Standardization
block. Tablas column I (IMSFE) was computed from the Standardization hierarchy and
is correct; recomputing IMSFE from Tablas C–H alone is wrong.

## Method the app must implement

1. Ratio standardisation on the 0–10 scale: DMP (benefit) `10 * x / max`;
   IMP (cost) `10 * min / x` (non-positive → NaN), matching Standardization formulas.
2. Criterion score = SUMPRODUCT(within-criterion variable weights, variable scores).
3. IMSFE = SUMPRODUCT(criterion weights, criterion scores).
4. Do **not** trust a pasted Tablas criterion table without regenerating from
   Standardization formulas.

## Personal data

Sheet `1. Total Average for criteria` lists respondent names. Extractors must emit
only `Expert 1..n`. Never commit names into fixtures, tests or UI.
