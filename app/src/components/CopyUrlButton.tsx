import { useState } from "react";
import { useTranslation } from "../i18n";

/** Copy an endpoint template; always shows visible success/error feedback. */
export function CopyUrlButton({ url }: { url: string }) {
  const { t } = useTranslation();
  const [note, setNote] = useState<string | null>(null);

  return (
    <span className="copy-url">
      <code className="endpoint-template">{url}</code>
      <button
        type="button"
        data-testid="copy-endpoint"
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(url);
              setNote(t("copied"));
            } catch {
              setNote(t("copyFailed"));
            }
            window.setTimeout(() => setNote(null), 2000);
          })();
        }}
      >
        {t("copy")}
      </button>
      {note ? (
        <span className="muted small" role="status">
          {note}
        </span>
      ) : null}
    </span>
  );
}
