export type Implementation = {
  id: string;
  available: boolean;
  mutant: boolean;
};
export type CaseResult = {
  name: string;
  input: number[][];
  expected: number[][];
  actual: unknown;
  passed: boolean;
};
export type Result = {
  language: string;
  status: "passed" | "failed" | "unavailable" | "timeout" | "error";
  passed: number;
  total: number;
  duration_ms: number | null;
  error?: string;
  cases?: CaseResult[];
};
export type Review = {
  version: number;
  verdict: string;
  note: string;
  created_at: string;
};
export type Run = {
  id: string;
  created_at: string;
  suite: string;
  results: Result[];
  verdict: "unreviewed" | "approved" | "needs-work";
  note: string;
  version: number;
  reviews?: Review[];
};
export const names: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  go: "Go",
  rust: "Rust",
  "javascript-mutant": "Boundary bug demo",
};
