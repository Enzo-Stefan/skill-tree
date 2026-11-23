import { useEffect, useRef } from "react";
import type { PlayerLevel } from "../types";
import { PRACTICE_DAYS_PER_WEEK, STREAK_WEEKS } from "../lib/streak";

interface Props {
  levels: PlayerLevel[];
  currentId: string | null;
  onPick: (id: string) => void;
  /** Levels this player may switch to right now. Others show as locked. Defaults to all. */
  canPick?: (id: string) => boolean;
  onClose: () => void;
  /** Text on the close button: "Cancel" when changing level, "Skip for now" on first visit. */
  closeLabel: string;
}

export function LevelPicker({ levels, currentId, onPick, canPick = () => true, onClose, closeLabel }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const locked = levels.some((l) => !canPick(l.id));
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
        onCloseRef.current();
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
        <p>
          {locked
            ? `You can move to a lower level any time. To move up, train ${PRACTICE_DAYS_PER_WEEK} days a week for ${STREAK_WEEKS} weeks and pass the test.`
            : "Some tests have a different target for each level. You'll only see yours."}
        </p>
        <div className="level-options">
          {levels.map((l, i) => {
            const allowed = canPick(l.id);
            return (
              <button
                key={l.id}
                ref={i === 0 ? firstButton : undefined}
                type="button"
                className={`level-option${l.id === currentId ? " current" : ""}${allowed ? "" : " locked"}`}
                disabled={!allowed}
                onClick={() => onPick(l.id)}
              >
                <span className="level-option-name">{l.name}</span>
                <span className="level-option-hint">{allowed ? l.hint : "Pass the test to move up"}</span>
              </button>
            );
          })}
        </div>
        <button className="btn" type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
