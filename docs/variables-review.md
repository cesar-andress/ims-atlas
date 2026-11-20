# Variable verification (SPEC §4)

Public releases include only variables with `status: verified` **and** a ship
gate (`ship_raw` / `ship_derived`). Internal (cerrada) releases may still carry
`use_research=yes` draft variables so the team can work before verification.

## How César confirms

```bash
BY=CA scripts/variables-confirm.sh
```

The script:

1. Skips variables already `verified`.
2. Prints for each draft variable: id, upstream code, sources, gate decision,
   coverage (when curated tables exist), three sample values, and a URL to check.
3. Does **not** write `status: verified` until you run `atlas-etl verify`.

After reviewing the printed samples against the upstream URL:

```bash
uv run atlas-etl verify <ID> --by CA
# or the batch loop printed at the end of variables-confirm.sh
```

Then commit `catalog/variables.yaml` (and regenerate transparency exports).

## Agents

Agents must **not** run this script or call `atlas-etl verify`. They only prepare
the script and the review document.
