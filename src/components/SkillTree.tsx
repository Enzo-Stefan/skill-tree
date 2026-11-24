import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Skill, SkillState, Tree } from "../types";
import { skillState } from "../lib/progress";

const SLOT = 104;
const ROW = 140;
const PAD_X = 56;
const TOP = 70;

interface Props {
  tree: Tree;
  done: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Show one branch only, as a narrow column. Used on phones. */
  branchId?: string | null;
}

export function SkillTree({ tree, done, selectedId, onSelect, branchId = null }: Props) {
  const effects = useUnlockEffects(tree, done);
  // Skill names grow with the browser's text size, so the spacing grows with them or they overlap.
  const [scale] = useState(textScale);
  const slot = SLOT * scale;
  const row = ROW * scale;
  const narrow = branchId !== null;
  const branchIndex = tree.branches.findIndex((b) => b.id === branchId);

  // In narrow mode keep the start, the chosen branch and the final skill,
  // and squeeze the branch's two slots down to slots 0 and 1.
  const visible = narrow
    ? tree.skills.filter((s) => s.branch === null || s.branch === branchId)
    : tree.skills;
  const slotOf = (s: Skill) => (!narrow ? s.x : s.branch === null ? 0.5 : s.x - branchIndex * 2);
  const slots = narrow ? 2 : tree.branches.length * 2;

  const pos = (s: Skill) => ({ x: PAD_X + slotOf(s) * slot + slot / 2, y: TOP + s.row * row + 40 });
  const maxRow = Math.max(...tree.skills.map((s) => s.row));
  const width = PAD_X * 2 + slots * slot;
  const height = TOP + maxRow * row + ROW;
  const visibleIds = new Set(visible.map((s) => s.id));
  const byId = new Map(tree.skills.map((s) => [s.id, s]));
  const colorOf = (s: Skill) => tree.branches.find((b) => b.id === s.branch)?.color ?? "#f2c14e";

  return (
    <div className="pitch-wrap">
      <div className="pitch" style={{ width, height }}>
        <svg className="lines" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
          <circle className="centre" cx={width / 2} cy={TOP + 40} r={70} fill="none" strokeWidth={2} />
          {visible.flatMap((child) =>
            child.requires
              .filter((parentId) => visibleIds.has(parentId))
              .map((parentId) => {
                const parent = byId.get(parentId)!;
                const a = pos(parent);
                const b = pos(child);
                const y1 = a.y + (parent.big ? 42 : 34);
                const y2 = b.y - (child.big ? 42 : 34);
                const mid = (y1 + y2) / 2;
                const both = done.has(parentId) && done.has(child.id);
                const lit = done.has(parentId);
                return (
                  <path
                    key={`${parentId}-${child.id}`}
                    d={`M${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`}
                    className={both ? "both" : lit ? "lit" : undefined}
                    style={both ? ({ "--c": colorOf(child) } as CSSProperties) : undefined}
                    fill="none"
                    strokeWidth={both ? 3 : 2}
                    strokeDasharray={both ? undefined : "6 6"}
                  />
                );
              }),
          )}
        </svg>

        {!narrow &&
          tree.branches.map((b, i) => (
            <div
              key={b.id}
              className="branch-label"
              style={{ "--c": b.color, left: PAD_X + (i * 2 + 1) * slot, top: TOP + row - 26 } as CSSProperties}
            >
              {b.name}
            </div>
          ))}

        {visible.map((s) => {
          const state = skillState(s, done);
          const p = pos(s);
          return (
            <button
              key={s.id}
              type="button"
              className={`node ${state}${s.big ? " big" : ""}${s.id === selectedId ? " selected" : ""}${effects.get(s.id) ? ` fx-${effects.get(s.id)}` : ""}`}
              style={{ left: p.x, top: p.y, width: slot - 8, "--c": colorOf(s) } as CSSProperties}
              onClick={() => onSelect(s.id)}
              aria-label={`${s.name}, ${state}`}
            >
              <span className="tile">
                {state === "done" ? <CheckIcon /> : state === "locked" ? <LockIcon /> : tileLabel(s)}
              </span>
              <span className="name">{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The browser's text size against the default 16px, never below 1, so the default layout is unchanged. */
function textScale(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) ? Math.max(1, px / 16) : 1;
}

/** Text inside an open (available) tile: GO for the start, 90' for the final, else the tier number. */
function tileLabel(s: Skill): string {
  if (s.big) return "90'";
  if (s.requires.length === 0) return "GO";
  return String(s.row);
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

type Effect = "done" | "unlock";

/** Which skills just finished or just unlocked, so their tiles can animate for a moment. */
function useUnlockEffects(tree: Tree, done: Set<string>): Map<string, Effect> {
  const previous = useRef<Map<string, SkillState> | null>(null);
  const [effects, setEffects] = useState<Map<string, Effect>>(new Map());

  useEffect(() => {
    const current = new Map(tree.skills.map((s) => [s.id, skillState(s, done)]));
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    const changed = new Map<string, Effect>();
    for (const [id, state] of current) {
      const was = before.get(id);
      if (state === "done" && was !== "done") changed.set(id, "done");
      else if (state === "available" && was === "locked") changed.set(id, "unlock");
    }
    // Always replace the effects, even with an empty map. A quick undo cancels the
    // previous clear-timer, so returning early here would leave old fx classes stuck.
    setEffects(changed);
    if (changed.size === 0) return;
    const timer = window.setTimeout(() => setEffects(new Map()), 900);
    return () => window.clearTimeout(timer);
  }, [tree, done]);

  return effects;
}
