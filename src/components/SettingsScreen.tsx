import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Auth } from "../auth/useAuth";
import { AccountDialog } from "./AccountDialog";
import { SignInDialog } from "./SignInDialog";
import { t } from "../i18n";

interface Props {
  auth: Auth;
  /** The tree's short name, e.g. "Football", for the Reset row. */
  treeName: string;
  /** The player's level and step, e.g. "Beginner 2". Leave undefined for trees without levels. */
  playerLevelName?: string | null;
  onChangeLevel?: () => void;
  onCopy: () => void;
  onReset: () => void;
  /** Called after the account was deleted, e.g. to show a message. */
  onDeleted: () => void;
}

/** Level, account, copy and reset, and the privacy page: everything that isn't training. */
export function SettingsScreen({ auth, treeName, playerLevelName, onChangeLevel, onCopy, onReset, onDeleted }: Props) {
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

      <Group title={t.settings.progress}>
        <Row label={t.header.copy} onClick={onCopy} />
        <ResetRow treeName={treeName} onReset={onReset} />
      </Group>

      <Group title={t.settings.about}>
        <a className="settings-row" href="/privacy.html">
          <span className="settings-row-text">
            <span>{t.settings.privacy}</span>
            <span className="settings-row-sub">{t.settings.privacySub}</span>
          </span>
          <Chevron />
        </a>
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
  onClick: () => void;
}

function Row({ label, sub, value, icon, chevron, danger, onClick }: RowProps) {
  return (
    <button className={`settings-row${danger ? " danger" : ""}`} type="button" onClick={onClick}>
      {icon}
      <span className="settings-row-text">
        <span>{label}</span>
        {sub && <span className="settings-row-sub">{sub}</span>}
      </span>
      {value && <span className="settings-row-value">{value}</span>}
      {chevron && <Chevron />}
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

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    <img className="account-avatar" src={url} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="account-avatar" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Chevron() {
  return (
    <svg className="settings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
