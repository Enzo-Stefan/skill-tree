interface Props {
  /** Skills finished since the player last picked a level or said "not yet". */
  finished: number;
  currentName: string;
  nextName: string;
  onAccept: () => void;
  onLater: () => void;
}

export function LevelUpBanner({ finished, currentName, nextName, onAccept, onLater }: Props) {
  return (
    <section className="levelup" role="region" aria-label="Level up offer">
      <p>
        You've finished {finished} skills at {currentName}. Move up to <strong>{nextName}</strong>?
      </p>
      <div className="levelup-actions">
        <button className="btn primary" type="button" onClick={onAccept}>
          Move up
        </button>
        <button className="btn" type="button" onClick={onLater}>
          Not yet
        </button>
      </div>
    </section>
  );
}
