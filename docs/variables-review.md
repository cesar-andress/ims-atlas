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
2. Prints a table (ship_raw sources first): id, Spanish name, source, ESP/COL/DEU
   samples when curated data exist, and a URL to check.
3. Prints **one** batch `atlas-etl verify` loop for the ship-first group you approve.
4. Does **not** write `status: verified` until you run that command.

After the ship-first group is verified, the next dual release will set
`n_included_variables > 0` on the public audience and visitors will see real
country-year cells (not only the illustrative example).

## Agents

Agents must **not** run this script or call `atlas-etl verify`. They only prepare
the script and the review document.
