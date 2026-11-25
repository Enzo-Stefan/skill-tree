import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TreeSummary } from "../lib/activeTree";
import { panelIn, panelOut } from "../lib/areaSlide";
import { useModalFocus } from "./useModalFocus";
import { t } from "../i18n";

const STRENGTH_ID = "weights";

interface Props {
  trees: TreeSummary[];
  /** Switch to this tree. Resolves once the switch has been started: on success the page reloads right after, so the panel is only usable again for that moment. */
  onSwitch: (treeId: string) => Promise<void>;
}

/**
 * A handle for the Train header that slides out a side panel offering the Strength tree.
 * Hidden unless Strength is built and isn't the tree already open. Picking it uses the same switch as the
 * Areas tab, so the save is flushed and the page reloads.
 */
export function StrengthPanel({ trees, onSwitch }: Props) {
  const strength = trees.find((tr) => tr.id === STRENGTH_ID && !tr.active && !tr.soon);
  const [open, setOpen] = useState(false);
  const handle = useRef<HTMLButtonElement | null>(null);
  if (!strength) return null;
  return (
    <>
      <button ref={handle} type="button" className="strength-handle" aria-label={t.strengthPanel.handleLabel} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t.strengthPanel.handle}
      </button>
      {/* Portalled to <body>: inside the sticky, backdrop-filtered .switcher on phones, position:fixed would size to the strip. */}
      {open && createPortal(<Panel tree={strength} onSwitch={onSwitch} onClose={() => { setOpen(false); handle.current?.focus(); }} />, document.body)}
    </>
  );
}

function Panel({ tree, onSwitch, onClose }: { tree: TreeSummary; onSwitch: Props["onSwitch"]; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement | null>(null);
  const [switching, setSwitching] = useState(false);
  const [closing, setClosing] = useState(false);
  // The panel slides in once, when it first mounts.
  const started = useRef(false);

  function close() {
    if (switching || closing) return;
    setClosing(true);
    panelOut(dialog.current, onClose);
  }
  // Focus goes back to the handle (the parent does it on close), not to whatever was active on mount:
  // Safari doesn't focus a button on click, so that would be <body>.
  const skipRestore = useRef(false);
  useModalFocus(dialog, close, skipRestore);

  async function pick() {
    if (switching) return;
    setSwitching(true);
    await onSwitch(tree.id);
    setSwitching(false);
  }

  return (
    <div className="overlay strength-overlay" onClick={close}>
      <div
        ref={(el) => {
          dialog.current = el;
          if (el && !started.current) {
            started.current = true;
            panelIn(el);
          }
        }}
        className="dialog strength-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strength-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="strength-panel-title">{t.strengthPanel.title}</h2>
        <p>{tree.tagline}</p>
        <p>{t.strengthPanel.progress(tree.done, tree.total, tree.rank)}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" aria-busy={switching} disabled={switching} onClick={() => void pick()}>
            {switching ? t.strengthPanel.opening : t.strengthPanel.open}
          </button>
          <button type="button" className="btn" onClick={close}>
            {t.strengthPanel.close}
          </button>
        </div>
      </div>
    </div>
  );
}
