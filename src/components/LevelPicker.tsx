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
  const dialog = useRef<HTMLDivElement>(null);
  const firstButton = useRef<HTMLButtonElement>(null);
  // App passes a new onClose function on every render, so read it through a ref
  // instead of re-running the effects (which would move focus back to the first option).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstButton.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !dialog.current) return;
      const items = dialog.current.querySelectorAll<HTMLElement>("button");
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!first || !last) return;
      if (!dialog.current.contains(active) || (e.shiftKey && active === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialog}
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
