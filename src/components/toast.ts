export interface ToastAction {
  label: string;
  /** What a screen reader says, when the visible label alone is unclear ("Undo" what?). */
  accessibleLabel?: string;
  run: () => void;
}

export interface Toast {
  text: string;
  action?: ToastAction;
}
