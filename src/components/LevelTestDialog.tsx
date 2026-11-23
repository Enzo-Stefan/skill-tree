import { useRef } from "react";
import { useModalFocus } from "./useModalFocus";

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
  /** Closing with Escape or a tap outside: just closes, the question can come back straight away. */
  onDismiss: () => void;
}

export function LevelTestDialog({ nextName, items, onPass, onNotYet, onDismiss }: Props) {
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
        <h2 id="level-test-title">{nextName} test</h2>
        <p>Do these at the {nextName} targets. Pass them all and you move up to {nextName}.</p>
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
            I passed
          </button>
          <button className="btn" type="button" onClick={onNotYet}>
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
