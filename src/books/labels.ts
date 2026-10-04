/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
export const BOOK_ROLES = {
  "front-matter": "Opening pages",
  part: "Part",
  chapter: "Chapter",
  scene: "Scene",
  "back-matter": "Closing pages",
} as const;
export function bookRoleLabel(role: string): string {
  return BOOK_ROLES[role as keyof typeof BOOK_ROLES] ?? "Section";
}
