import { useEffect } from "react";
import { useAccessSession } from "../auth/accessSession";
import { setProjectLibraryMode } from "../state/projectLibrary";

/** Prefer the shared team library whenever Authelia says we are signed in. */
export function ProjectLibraryModeSync() {
  const { status } = useAccessSession();
  useEffect(() => {
    setProjectLibraryMode(status === "authenticated" ? "team" : "local");
  }, [status]);
  return null;
}
