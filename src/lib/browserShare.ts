/** The browser's share, clipboard and prompt, as shareChallenge takes them (each missing where the browser lacks it). */
export function browserShare() {
  return {
    share: typeof navigator.share === "function" ? (d: ShareData) => navigator.share(d) : undefined,
    writeText: navigator.clipboard ? (v: string) => navigator.clipboard.writeText(v) : undefined,
    prompt: (m: string, v: string) => window.prompt(m, v),
  };
}
