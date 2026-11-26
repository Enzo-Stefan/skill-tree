import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { Skill, SkillState, Tree } from "../types";
import { skillState } from "../lib/progress";
import { masteryTiers, TIER_PIPS } from "./mastery";
import type { TestResult } from "../lib/results";
import type { MasteryTier } from "../lib/xp";
import { ZoomPane, type ZoomPaneHandle } from "./ZoomPane";
import { connectorPath, TREE_PANEL_ID, treeEdges, treeGrid } from "./treeView";
import { t } from "../i18n";

/** A request to scroll the tree to a skill. A new object each time, so asking for the same skill twice works. */
export interface ScrollRequest {
  id: string;
}

interface Props {
  tree: Tree;
  done: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** The branch picked in the switcher, highlighted in the tree. null is "All". */
  branchId: string | null;
  /** Always one column, for phones. Otherwise one column only when the space is too narrow for the branches side by side. */
  phone: boolean;
  /** The skill suggested next (nextSkill in lib/progress.ts), marked in the tree. */
  nextId: string | null;
  /** Scrolls this skill to the middle of the screen, smoothly. */
  scrollTo: ScrollRequest | null;
  /** The saved test results, which decide the mastery badge on passed skills. */
  results: TestResult[];
}

/**
 * The skill tree. It grows upward like a real tree: the first skill sits at the bottom, the final
 * skill at the top, and lines grow from each skill up to the skills it unlocks.
 *
 * Wide screens: every skill on its own spot from the tree data (tier and slot), one band per branch,
 * with lines drawn between skills. Phones, and any space too narrow for that: one column. The final skill is on top, then each branch
 * (the first branch nearest the bottom), then the start skill. Inside a branch, skills are listed in
 * the order they unlock, last one on top. A branch isn't a straight line (two skills open after the
 * first, and the last needs two), so a locked skill says which skills it is waiting for.
 */
export function SkillTree({ tree, done, selectedId, onSelect, branchId, phone, nextId, scrollTo, results }: Props) {
  const effects = useUnlockEffects(tree, done);
  const tiers = useMemo(() => masteryTiers(tree, done, results), [tree, done, results]);
  const [treeEl, setTreeEl] = useState<HTMLDivElement | null>(null);
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null);
  const start = tree.skills.filter((s) => s.branch === null && s.requires.length === 0);
  const finish = tree.skills.filter((s) => s.branch === null && s.requires.length > 0);
  const colorOf = (s: Skill) => tree.branches.find((b) => b.id === s.branch)?.color ?? "var(--fg-2)";
  const nameOf = (id: string) => tree.skills.find((s) => s.id === id)?.name ?? id;
  const grid = useMemo(() => treeGrid(tree), [tree]);
  const room = useWidth(wrapEl);
  // Names need about 72px a slot (two columns) to fit on a line. Before the first measure, the page's width stands in.
  const stacked = phone || (room ?? window.innerWidth) < (grid.columns / 2) * SLOT_PX + WRAP_PADDING_PX;
  // On phones the map is opt-in: the list stays the default, since its skills are always full size.
  const [mapOpen, setMapOpen] = useState(false);
  const zoomed = !stacked || mapOpen;
  const layout = zoomed ? "card" : "row";
  const pane = useRef<ZoomPaneHandle>(null);

  useScrollTo(treeEl, scrollTo, zoomed ? pane : null);
  useStartAtBase(wrapEl, stacked && !mapOpen);

  const item = (s: Skill) => {
    const state = skillState(s, done);
    const waitingFor = s.requires.filter((id) => !done.has(id)).map(nameOf);
    const tier = tiers.get(s.id);
    return (
      <SkillItem
        key={s.id}
        skill={s}
        state={state}
        layout={layout}
        color={colorOf(s)}
        // In the phone list the open skill shows in the sheet instead.
        selected={layout === "card" && s.id === selectedId}
        next={s.id === nextId}
        effect={effects.get(s.id)}
        tier={tier}
        sub={state === "done" ? (tier ? t.tree.passedWith(t.tree.mastery[tier]) : t.tree.passed) : state === "locked" ? t.tree.after(waitingFor) : t.panel.status.available}
        onSelect={onSelect}
      />
    );
  };

  // Top of the screen first, so the reading and Tab order follow what is on screen.
  const topFirst = (skills: Skill[]) => [...skills].sort((a, b) => b.row - a.row || a.x - b.x);
  const branches = tree.branches.map((b) => ({ branch: b, skills: topFirst(tree.skills.filter((s) => s.branch === b.id)) }));

  const label = tree.shortName ?? tree.title;

  const toggle = stacked && (
    <div className="view-toggle" role="group" aria-label={t.tree.viewLabel}>
      <button type="button" aria-pressed={!mapOpen} onClick={() => setMapOpen(false)}>
        {t.tree.viewList}
      </button>
      <button type="button" aria-pressed={mapOpen} onClick={() => setMapOpen(true)}>
        {t.tree.viewMap}
      </button>
    </div>
  );

  if (stacked && !mapOpen) {
    return (
      <div className="tree-wrap" id={TREE_PANEL_ID} role="tabpanel" aria-label={label} ref={setWrapEl}>
        {toggle}
        <div className="tree stacked" ref={setTreeEl}>
          <div className="tree-end">{finish.map(item)}</div>
          {[...branches].reverse().map(({ branch, skills }) => {
            const count = skills.filter((s) => done.has(s.id)).length;
            return (
              <section
                key={branch.id}
                className={`branch-col${branch.id === branchId ? " focused" : ""}`}
                aria-label={branch.name}
                style={{ "--c": branch.color } as CSSProperties}
              >
                <div className="branch-head">
                  <h3>
                    <span className="branch-dot" aria-hidden="true" />
                    {branch.name}
                  </h3>
                  <p className="branch-count">{t.tree.branchCount(count, skills.length)}</p>
                </div>
                <ol className="skill-list">
                  {skills.map((s, i) => {
                    // The line down to the skill below it: lit once that one is passed, growing when this one opens.
                    // The first skill in a branch has none below, so its line is a short stub down to the start.
                    const below = skills[i + 1];
                    const lit = below ? done.has(below.id) : s.requires.length > 0 && s.requires.every((r) => done.has(r));
                    const classes = [
                      "skill-li",
                      skillState(s, done),
                      "has-rail",
                      !below && "rail-stub",
                      lit && "rail-lit",
                      effects.get(s.id) === "unlock" && "rail-grow",
                    ];
                    return (
                      <li key={s.id} className={classes.filter(Boolean).join(" ")} style={{ "--c": colorOf(s) } as CSSProperties}>
                        {item(s)}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
          <div className="tree-end">{start.map(item)}</div>
        </div>
      </div>
    );
  }

  const place = (s: Skill, offset = 0): CSSProperties => {
    const spot = grid.spots.get(s.id)!;
    return { gridColumn: `${spot.column - offset} / span ${spot.span}`, gridRow: spot.row };
  };

  return (
    <div className="tree-wrap zoomed" id={TREE_PANEL_ID} role="tabpanel" aria-label={label} ref={setWrapEl}>
      {toggle}
      <ZoomPane ref={pane}>
      <div
        className="tree wide map"
        ref={setTreeEl}
        style={{ width: (grid.columns / 2) * MAP_SLOT_PX + 2 * MAP_PADDING_PX, gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${grid.rows}, auto)` }}
      >
        <Connectors tree={tree} done={done} effects={effects} colorOf={colorOf} container={treeEl} />
        {finish.map((s) => (
          <div key={s.id} className="tree-end" style={place(s)}>
            {item(s)}
          </div>
        ))}
        {branches.map(({ branch, skills }) => {
          const band = grid.bands.get(branch.id);
          if (!band) return null;
          const count = skills.filter((s) => done.has(s.id)).length;
          return (
            <section
              key={branch.id}
              className={`branch-col${branch.id === branchId ? " focused" : ""}`}
              aria-label={branch.name}
              style={{ "--c": branch.color, gridColumn: `${band.column} / span ${band.span}`, gridRow: `2 / ${grid.rows}` } as CSSProperties}
            >
              <div className="branch-head">
                <h3>
                  <span className="branch-dot" aria-hidden="true" />
                  {branch.name}
                </h3>
                <p className="branch-count">{t.tree.branchCount(count, skills.length)}</p>
              </div>
              <ol className="branch-grid">
                {skills.map((s) => {
                  const spot = grid.spots.get(s.id)!;
                  return (
                    <li
                      key={s.id}
                      className={`skill-li ${skillState(s, done)}`}
                      style={{ "--c": colorOf(s), gridColumn: `${spot.column - band.column + 1} / span ${spot.span}`, gridRow: spot.row - 2 } as CSSProperties}
                    >
                      {item(s)}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        {start.map((s) => (
          <div key={s.id} className="tree-end" style={place(s)}>
            {item(s)}
          </div>
        ))}
      </div>
      </ZoomPane>
    </div>
  );
}

interface ConnectorsProps {
  tree: Tree;
  done: Set<string>;
  effects: Map<string, Effect>;
  colorOf: (s: Skill) => string;
  /** The tree the lines are drawn in. Null until it is on the page. */
  container: HTMLDivElement | null;
}

/**
 * The lines between skills, drawn behind them. Each starts at the lower skill and ends at the upper one,
 * so when a skill opens its line grows upward, like growth moving up a branch. The skills' places come from
 * the page, so the lines are measured again when the tree changes size.
 */
function Connectors({ tree, done, effects, colorOf, container }: ConnectorsProps) {
  const [drawn, setDrawn] = useState<{ width: number; height: number; paths: Map<string, string> }>({ width: 0, height: 0, paths: new Map() });

  useLayoutEffect(() => {
    if (!container) return;
    const measure = () => {
      const box = container.getBoundingClientRect();
      // The map can be scaled by a transform; rects are in screen pixels, the lines are in the map's own.
      const k = box.width / container.offsetWidth || 1;
      const node = (id: string) => container.querySelector<HTMLElement>(`[data-skill-id="${CSS.escape(id)}"] .skill-node`)?.getBoundingClientRect();
      const paths = new Map<string, string>();
      for (const e of treeEdges(tree)) {
        const lower = node(e.from);
        const upper = node(e.to);
        if (!lower || !upper) continue;
        const from = { x: (lower.left + lower.width / 2 - box.left) / k, y: (lower.top - box.top) / k };
        const to = { x: (upper.left + upper.width / 2 - box.left) / k, y: (upper.bottom - box.top) / k };
        paths.set(`${e.from}>${e.to}`, connectorPath(from, to));
      }
      setDrawn({ width: container.scrollWidth, height: container.scrollHeight, paths });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // Web fonts change how names wrap, which moves the skills.
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [tree, done, container]);

  return (
    <svg className="edges" width={drawn.width} height={drawn.height} aria-hidden="true">
      {treeEdges(tree).map((e) => {
        const d = drawn.paths.get(`${e.from}>${e.to}`);
        if (!d) return null;
        const target = tree.skills.find((s) => s.id === e.to)!;
        // The line that opened this skill: its lower skill was just passed and the upper one just opened.
        const grow = effects.get(e.from) === "done" && effects.get(e.to) === "unlock";
        return (
          <g key={`${e.from}>${e.to}`} style={{ "--c": colorOf(target) } as CSSProperties}>
            <path d={d} className="edge base" />
            {done.has(e.from) && <path d={d} pathLength={1} className={`edge lit${grow ? " grow" : ""}`} />}
          </g>
        );
      })}
    </svg>
  );
}

/** Scrolls the tree to a skill when asked. Smooth, unless the player asked for less motion. */
function useScrollTo(tree: HTMLElement | null, request: ScrollRequest | null, zoom: RefObject<ZoomPaneHandle | null> | null) {
  useEffect(() => {
    if (!request) return;
    // Wait a frame: when Train was hidden until this render (coming back from Areas), Chrome drops
    // a smooth scroll that starts in the same frame it becomes visible.
    const frame = requestAnimationFrame(() => {
      const skill = tree?.querySelector<HTMLElement>(`[data-skill-id="${CSS.escape(request.id)}"]`);
      if (zoom) {
        if (skill) zoom.current?.centerOn(skill);
        return;
      }
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      skill?.scrollIntoView({ block: "center", inline: "nearest", behavior: calm ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [request, tree, zoom]);
}

/**
 * The tree grows upward, so the player starts at its base: the first skill, at the bottom. Scrolls
 * the tree's own scroll area (wide screens) and the Train page it sits in (phones) all the way down, and
 * does it again when the layout changes between one column and side by side, since that's a different height.
 */
function useStartAtBase(wrap: HTMLElement | null, stacked: boolean) {
  useLayoutEffect(() => {
    if (!wrap) return;
    for (const area of [wrap, wrap.closest<HTMLElement>(".train")]) {
      if (area) area.scrollTop = area.scrollHeight;
    }
  }, [wrap, stacked]);
}

/** The width of an element, kept up to date. Null until it has been measured. */
function useWidth(el: HTMLElement | null): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    // A hidden Train tab measures 0. Keep the last real width, so the layout doesn't flip while it is away.
    const measure = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return width;
}

/** Room one slot (two grid columns) of the wide tree needs, and the tree area's side padding. Keep in sync with tree.css. */
const SLOT_PX = 72;
const WRAP_PADDING_PX = 48;
/** The map's own size: a slot this wide, and padding all round. Names fit at this size, and the pane scales it. */
const MAP_SLOT_PX = 96;
const MAP_PADDING_PX = 24;

interface ItemProps {
  skill: Skill;
  state: SkillState;
  layout: "card" | "row";
  color: string;
  selected: boolean;
  next: boolean;
  effect?: Effect;
  tier?: MasteryTier;
  /** Passed, Ready to train, or what it's waiting for. Shown in the phone list, and read out everywhere. */
  sub: string;
  onSelect: (id: string) => void;
}

function SkillItem({ skill, state, layout, color, selected, next, effect, tier, sub, onSelect }: ItemProps) {
  const classes = ["skill", layout, state, selected && "selected", next && "next", skill.big && "big", effect && `fx-${effect}`];
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(" ")}
      style={{ "--c": color } as CSSProperties}
      onClick={() => onSelect(skill.id)}
      data-skill-id={skill.id}
      aria-label={t.tree.nodeLabel(skill.name, sub, next)}
      aria-current={selected ? "true" : undefined}
    >
      <span className="skill-node" aria-hidden="true">
        {state === "done" ? <CheckIcon /> : state === "locked" ? <LockIcon /> : tileLabel(skill)}
        {tier && (
          <span className={`mastery ${tier}`}>
            {Array.from({ length: TIER_PIPS[tier] }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        )}
      </span>
      <span className="skill-text">
        <span className="skill-name">{skill.name}</span>
        {layout === "row" && <span className="skill-sub">{sub}</span>}
      </span>
      {next && <span className="skill-badge">{t.tree.nextUp}</span>}
    </button>
  );
}

/** Text inside an open skill's circle: GO for the start, 90' for the final, else a dot. */
function tileLabel(s: Skill) {
  if (s.big) return t.tree.finalTile;
  if (s.requires.length === 0) return t.tree.startTile;
  return <PlayIcon />;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.5 5.5v13l10-6.5z" />
    </svg>
  );
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

/** Which skills just finished or just unlocked, so their circles can animate for a moment. */
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
    const timer = window.setTimeout(() => setEffects(new Map()), 2000);
    return () => window.clearTimeout(timer);
  }, [tree, done]);

  return effects;
}
