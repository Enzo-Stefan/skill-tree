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
  onLater: () => void;
}

export function LevelTestDialog({ nextName, items, onPass, onLater }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, onLater);

  return (
    <div className="overlay" onClick={onLater}>
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
          <button className="btn" type="button" onClick={onLater}>
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
