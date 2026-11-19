type Props = {
  licenceId: string;
};

export function LicenceBadge({ licenceId }: Props) {
  const kind =
    licenceId === "UNKNOWN"
      ? "unknown"
      : licenceId.startsWith("CC-")
        ? "open"
        : "other";
  return (
    <span className={`licence-badge licence-${kind}`} title={licenceId}>
      {licenceId}
    </span>
  );
}
