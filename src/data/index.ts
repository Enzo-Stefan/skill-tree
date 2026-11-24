import { football } from "./football";
import { weights } from "./weights";
import type { Tree } from "../types";

// Add new trees here (guitar, chess, Albanian...).
// The app shows the first one. The weight training tree opens from a side panel once Enzo adds it (#18).
export const trees: Tree[] = [football, weights];
