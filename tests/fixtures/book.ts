/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
export const bookManifest = `---
page-foundry-book: 1
title: A Neutral Journey
author: Alex Example
language: en-GB
identifier: urn:example:neutral-book
entries:
  - id: preface
    role: front-matter
    path: Book/Preface.md
  - id: first-part
    role: part
    title: First Part
  - id: first-chapter
    role: chapter
    path: Book/Chapter One.md
  - id: scene-one
    role: scene
    path: Book/Scene One.md
  - id: last-chapter
    role: chapter
    path: Book/Chapter Two.md
  - id: afterword
    role: back-matter
    path: Book/Afterword.md
---
This explanatory manifest text is excluded from the book.
`;
export const bookNotes: Record<string, string> = {
  "Book/Preface.md":
    "---\ntitle: Preface\n---\n\n# Preface\n\nAn invented journey for testing portable publishing.\n",
  "Book/Chapter One.md":
    "---\ntitle: Chapter One\n---\n\n# Chapter One\n\nThe traveller found a quiet garden. [Continue](Chapter%20Two.md#arrival).\n\n## Arrival\n\nThe first arrival has its own destination. [Return](#arrival).\n",
  "Book/Scene One.md":
    "---\ntitle: A Small Scene\n---\n\nThe gate opened slowly. This scene continues without a forced page break.\n",
  "Book/Chapter Two.md":
    "---\ntitle: Chapter Two\n---\n\n# Chapter Two\n\n## Arrival\n\nThe second arrival is distinct. [First chapter](Chapter%20One.md). [Outside the book](Unlisted.md).\n",
  "Book/Afterword.md":
    "---\ntitle: Afterword\n---\n\nThe journey ends here. Sources remain unchanged.\n",
};
