import { useEffect, useRef } from "react";
import type { PlayerLevel } from "../types";

interface Props {
  levels: PlayerLevel[];
  currentId: string | null;
  onPick: (id: string) => void;
  /** Leave out on first visit, so the player has to pick. */
  onClose?: () => void;
}

export function LevelPicker({ levels, currentId, onPick, onClose }: Props) {
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButton.current?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="level-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="level-picker-title">What's your level?</h2>
        <p>Some tests have a different target for each level. You'll only see yours. You can change it any time.</p>
        <div className="level-options">
          {levels.map((l, i) => (
            <button
              key={l.id}
              ref={i === 0 ? firstButton : undefined}
              type="button"
              className={`level-option${l.id === currentId ? " current" : ""}`}
              onClick={() => onPick(l.id)}
            >
              <span className="level-option-name">{l.name}</span>
              <span className="level-option-hint">{l.hint}</span>
            </button>
          ))}
        </div>
        {onClose && (
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
