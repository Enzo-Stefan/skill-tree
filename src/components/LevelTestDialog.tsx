import { useRef } from "react";
import { useModalFocus } from "./useModalFocus";
import { t } from "../i18n";

export interface TestItem {
  skillName: string;
  target: string;
}

interface Props {
  nextName: string;
  items: TestItem[];
  onPass: () => void;
  /** The "Not yet" button: the player says they are not ready, so the question waits until next week. */
  onNotYet: () => void;
  /** Text under the title. Defaults to the move-up text. */
  intro?: string;
  /** Text on the "Not yet" button. */
  notYetLabel?: string;
  /** Closing with Escape or a tap outside: just closes, the question can come back straight away. */
  onDismiss: () => void;
}

export function LevelTestDialog({ nextName, items, onPass, onNotYet, onDismiss, intro, notYetLabel }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, onDismiss);

  return (
    <div className="overlay" onClick={onDismiss}>
      <div
        ref={dialog}
        className="level-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-test-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="level-test-title">{t.levelTest.title(nextName)}</h2>
        <p>{intro ?? t.levelTest.intro(nextName)}</p>
        {items.length > 0 && (
          <ul className="test-list">
            {items.map((item) => (
              <li key={item.skillName}>
                <span>{item.skillName}</span>
                <strong>{item.target}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className="test-actions">
          <button className="btn primary" type="button" onClick={onPass}>
            {t.levelTest.passed}
          </button>
          <button className="btn" type="button" onClick={onNotYet}>
            {notYetLabel ?? t.levelTest.notYet}
          </button>
        </div>
      </div>
    </div>
  );
}
