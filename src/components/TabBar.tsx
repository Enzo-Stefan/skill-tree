import { t } from "../i18n";

export type Tab = "train" | "plan" | "progress" | "settings";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Rank, skill count and level, shown under the tabs in the laptop sidebar. */
  rank: string;
  summary: string[];
}

const TABS: Tab[] = ["train", "plan", "progress", "settings"];

/** The app's main navigation: a bar at the bottom on phones, a sidebar on wider screens. */
export function TabBar({ active, onChange, rank, summary }: Props) {
  return (
    <nav className="tabbar" aria-label={t.tabs.label}>
      <span className="tabbar-brand">{t.tabs.brand}</span>
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          className="tabbar-item"
          aria-current={tab === active ? "page" : undefined}
          onClick={() => onChange(tab)}
        >
          <TabIcon tab={tab} />
          <span>{t.tabs[tab]}</span>
        </button>
      ))}
      <div className="tabbar-summary">
        <span className="tabbar-rank">{rank}</span>
        {summary.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>
    </nav>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tab === "train") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (tab === "plan") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 2v4M16 2v4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    );
  }
  if (tab === "progress") {
    return (
      <svg {...common}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
