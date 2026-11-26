interface Props {
  /** Read out by screen readers while the rows are showing. */
  label: string;
  rows?: number;
}

/** Placeholder rows for a list that is still loading, in the same grey glass as the real rows. */
export function SkeletonRows({ label, rows = 5 }: Props) {
  return (
    <div className="skeleton-list" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true">
          <span className="skeleton-bar skeleton-rank" />
          <span className="skeleton-bar skeleton-name" />
          <span className="skeleton-bar skeleton-score" />
        </div>
      ))}
    </div>
  );
}
