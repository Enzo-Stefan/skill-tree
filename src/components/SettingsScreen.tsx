import { useEffect, useRef, useState, type ReactNode } from "react";
import { SkeletonRows } from "./Skeleton";
import type { Auth } from "../auth/useAuth";
import { AccountDialog } from "./AccountDialog";
import { SignInDialog } from "./SignInDialog";
import type { LeaderboardProfileState } from "../lib/useLeaderboardProfile";
import { deviceLanguage, LANGUAGES, savedLanguage, t, type Language } from "../i18n";

interface Props {
  auth: Auth;
  /** The tree's short name, e.g. "Football", for the Reset row. */
  treeName: string;
  /** The player's level and step, e.g. "Beginner 2". Leave undefined for trees without levels. */
  playerLevelName?: string | null;
  onChangeLevel?: () => void;
  onCopy: () => void;
  onReset: () => void;
  /** Called with the chosen language, or null to follow the phone. */
  onLanguage: (code: Language | null) => void;
  /** Called after the account was deleted, e.g. to show a message. */
  onDeleted: () => void;
  /** The player's leaderboard profile; leave undefined for trees without a leaderboard. */
  leaderboard?: LeaderboardProfileState;
  onMessage?: (text: string) => void;
  /** Opens the leaderboard profile dialog. */
  onEditProfile?: () => void;
}

/** Level, account, copy and reset, language, and About: everything that isn't training. */
export function SettingsScreen({ auth, treeName, playerLevelName, onChangeLevel, onCopy, onReset, onLanguage, onDeleted, leaderboard, onMessage, onEditProfile }: Props) {
  const [signInOpen, setSignInOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { account } = auth;
  const showAccount = auth.configured && !auth.loading;

  return (
    <div className="screen">
      <h1 className="screen-title">{t.tabs.settings}</h1>

      {onChangeLevel && (
        <Group title={t.settings.training}>
          <Row label={t.settings.yourLevel} value={playerLevelName ?? t.settings.pickLevel} chevron onClick={onChangeLevel} />
        </Group>
      )}

      {auth.configured && auth.loading && (
        <Group title={t.settings.account}>
          <SkeletonRows label={t.settings.account} rows={1} />
        </Group>
      )}

      {showAccount && (
        <Group title={t.settings.account}>
          {account ? (
            <>
              <Row
                label={account.name}
                sub={account.email ?? undefined}
                icon={<Avatar name={account.name} url={account.avatarUrl} />}
                chevron
                onClick={() => setAccountOpen(true)}
              />
              <Row label={t.account.signOut} onClick={() => void auth.signOut()} />
            </>
          ) : (
            <Row label={t.settings.signIn} sub={t.settings.signInSub} chevron onClick={() => setSignInOpen(true)} />
          )}
        </Group>
      )}

      {showAccount && account && leaderboard && onEditProfile && (
        <Group title={t.leaderboardProfile.group}>
          {leaderboard.error ? (
            <Row label={t.leaderboardProfile.loadFailed} sub={t.leaderboardProfile.retry} chevron onClick={leaderboard.retry} />
          ) : (
            <Row
              label={leaderboard.profile?.leaderboardOptIn ? t.leaderboardProfile.status.on : t.leaderboardProfile.status.off}
              sub={leaderboard.profile?.leaderboardOptIn ? t.leaderboardProfile.statusSub.on : t.leaderboardProfile.statusSub.off}
              value={leaderboard.profile?.displayName}
              chevron
              onClick={onEditProfile}
            />
          )}
          {!leaderboard.error && leaderboard.profile?.leaderboardOptIn && (
            <Row
              label={t.leaderboardProfile.leave}
              sub={t.leaderboardProfile.leaveSub}
              onClick={() => void leaderboard.leave().then((ok) => ok && onMessage?.(t.leaderboardProfile.left))}
            />
          )}
        </Group>
      )}

      <Group title={t.settings.progress}>
        <Row label={t.header.copy} onClick={onCopy} />
        <ResetRow treeName={treeName} onReset={onReset} />
      </Group>

      <LanguageGroup onLanguage={onLanguage} />

      <Group title={t.settings.about}>
        <a className="settings-row" href="/privacy.html">
          <span className="settings-row-text">
            <span>{t.settings.privacy}</span>
            <span className="settings-row-sub">{t.settings.privacySub}</span>
          </span>
          <Chevron />
        </a>
        <a className="settings-row" href={feedbackLink()}>
          <span className="settings-row-text">
            <span>{t.settings.feedback}</span>
            <span className="settings-row-sub">{t.settings.feedbackSub}</span>
          </span>
          <Chevron />
        </a>
        <div className="settings-row static">
          <span className="settings-row-text">
            <span>{t.settings.videos}</span>
            <span className="settings-row-sub">{t.settings.videosSub}</span>
          </span>
        </div>
        <div className="settings-row static">
          <span className="settings-row-text">
            <span>{t.settings.version}</span>
          </span>
          <span className="settings-row-value">{__APP_VERSION__}</span>
        </div>
      </Group>

      <p className="settings-note">{t.settings.followsPhone}</p>

      {signInOpen && <SignInDialog onGoogle={auth.signInWithGoogle} onClose={() => setSignInOpen(false)} />}
      {accountOpen && account && (
        <AccountDialog
          account={account}
          onClose={() => setAccountOpen(false)}
          onDelete={async () => {
            const error = await auth.deleteAccount();
            if (!error) {
              setAccountOpen(false);
              onDeleted();
            }
            return error;
          }}
        />
      )}
    </div>
  );
}

/** An email to both of us, with the build in the body so a bug report says which version it's about. */
function feedbackLink(): string {
  const subject = encodeURIComponent(t.settings.feedbackSubject);
  const body = encodeURIComponent(`\n\n${t.settings.version}: ${__APP_VERSION__}`);
  return `mailto:enzo.abuliak@gmail.com,gjinistefan00@gmail.com?subject=${subject}&body=${body}`;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group" aria-label={title}>
      <h2>{title}</h2>
      <div className="settings-list">{children}</div>
    </section>
  );
}

interface RowProps {
  label: string;
  sub?: string;
  value?: string;
  icon?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
  /** Shows a check mark and marks the row as the current choice. */
  checked?: boolean;
  /** The row's language, when it differs from the app's (language names). */
  lang?: string;
  onClick: () => void;
}

function Row({ label, sub, value, icon, chevron, danger, checked, lang, onClick }: RowProps) {
  return (
    <button
      className={`settings-row${danger ? " danger" : ""}`}
      type="button"
      aria-current={checked ? "true" : undefined}
      lang={lang}
      onClick={onClick}
    >
      {icon}
      <span className="settings-row-text">
        <span>{label}</span>
        {sub && <span className="settings-row-sub">{sub}</span>}
      </span>
      {value && <span className="settings-row-value">{value}</span>}
      {chevron && <Chevron />}
      {checked && <Check />}
    </button>
  );
}

/** Reset needs a second tap within 3 seconds, like it did in the header. */
function ResetRow({ treeName, onReset }: { treeName: string; onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handle() {
    if (!armed) {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    window.clearTimeout(timer.current);
    setArmed(false);
    onReset();
  }

  return (
    <Row
      label={armed ? t.header.resetConfirm : t.settings.reset}
      sub={t.settings.resetSub(treeName)}
      danger
      onClick={handle}
    />
  );
}

/** Follow the phone, or pick a language. The chosen row has a check mark. */
function LanguageGroup({ onLanguage }: { onLanguage: (code: Language | null) => void }) {
  const saved = savedLanguage();
  const nameOf = (code: Language) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  return (
    <Group title={t.settings.language}>
      <Row
        label={t.settings.phoneLanguage}
        sub={nameOf(deviceLanguage)}
        checked={saved === null}
        onClick={() => onLanguage(null)}
      />
      {LANGUAGES.map(({ code, name }) => (
        <Row key={code} label={name} lang={code} checked={saved === code} onClick={() => onLanguage(code)} />
      ))}
    </Group>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    <img className="account-avatar" src={url} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="account-avatar" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Check() {
  return (
    <svg className="settings-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="settings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
