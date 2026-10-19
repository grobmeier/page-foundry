/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import { readFile } from "node:fs/promises";
import { NOTE_TEMPLATES, createNoteSource } from "../src/notes/model";
import { expandNoteTemplate } from "../src/notes/templates";
import { serializeBookPlan } from "../src/books/editor";
import { fixturePng, fixtureJpeg } from "../tests/fixtures/images";

export async function authorTestExamples(
  folder = "Examples",
): Promise<Map<string, string | Uint8Array>> {
  if (!/^[A-Za-z ]+$/.test(folder))
    throw new Error("Use a simple example folder name.");
  const files = new Map<string, string | Uint8Array>();
  const put = (path: string, value: string | Uint8Array) =>
    files.set(`${folder}/${path}`, value);
  for (const template of NOTE_TEMPLATES.filter((t) => t.kind !== "book")) {
    const fields = {
      title:
        template.name === "Plain document"
          ? "A short field guide"
          : `Example ${template.name.toLowerCase()}`,
      author: "Alex Example",
      language: "en-GB",
      "sender-name": "Alex Example",
      "sender-address": "12 Willow Lane\nSampletown",
      "recipient-name": "Jamie Example",
      "recipient-address": "34 Meadow Road\nSampletown",
      date: "17 October 2026",
      subject: "A writing project",
      surname: "Example",
      "short-title": "Field Guide",
    };
    const applicable = template.kind.includes("letter")
      ? Object.fromEntries(
          Object.entries(fields).filter(
            ([key]) => !["author", "surname", "short-title"].includes(key),
          ),
        )
      : Object.fromEntries(
          Object.entries(fields).filter(
            ([key]) =>
              !key.startsWith("sender-") &&
              !key.startsWith("recipient-") &&
              !["date", "subject"].includes(key) &&
              (template.kind === "manuscript" ||
                !["surname", "short-title"].includes(key)),
          ),
        );
    const expanded = expandNoteTemplate(template, applicable);
    let source = createNoteSource(expanded, applicable);
    source = source
      .replace("Dear …,", "Dear Jamie,")
      .replace(
        "Write your letter here.",
        "Thank you for reading my draft. This letter tests readable addresses and a greeting and signature in the writing, not in properties.",
      )
      .replace(
        "Introduce your manuscript here.",
        "Please consider my manuscript, A Quiet Journey. This is a neutral covering letter for testing the submission workflow.",
      )
      .replace(
        "Start writing here.",
        "The path crossed a quiet meadow. Alex paused at the gate, opened the notebook and began to write.\n\n## A useful section\n\nA second paragraph contains **bold**, *emphasis* and a [safe link](https://example.org).\n\n- First observation\n- Second observation",
      );
    put(`Writing/${template.name}.md`, source);
  }
  const chapter = (title: string, body: string) =>
    `---\ntitle: ${title}\nauthor: Alex Example\nlanguage: en-GB\n---\n\n# ${title}\n\n${body}\n`;
  put(
    "Book/Preface.md",
    chapter(
      "Before the journey",
      "These opening pages introduce a neutral example book. The plan controls reading order; chapter notes remain independent Markdown files.",
    ),
  );
  put(
    "Book/Chapter one.md",
    chapter(
      "The gate",
      "The traveller stopped at the gate. Beyond it, a narrow path led into the valley.\n\n## A remembered promise\n\n" +
        "The notebook held observations, sketches and questions. Each morning brought another reason to keep going.\n\n".repeat(
          12,
        ),
    ),
  );
  put(
    "Book/Scene.md",
    chapter(
      "At the bridge",
      "A brief scene continues within the current chapter rather than forcing a chapter opening.",
    ),
  );
  put(
    "Book/Chapter two.md",
    chapter(
      "The valley",
      "The path followed the river. The traveller looked back at [the gate](Chapter%20one.md#the-gate).\n\n" +
        "The valley grew lighter as the clouds moved away. There was time to read the notes and choose the next direction.\n\n".repeat(
          12,
        ),
    ),
  );
  put(
    "Book/Afterword.md",
    chapter(
      "After the journey",
      "This small book is a layout proof, not a retailer-ready publication. Review its contents, page order and chapter openings.",
    ),
  );
  put(
    "Book/Reading order.book.md",
    serializeBookPlan({
      metadata: {
        title: "A Quiet Journey",
        author: "Alex Example",
        language: "en-GB",
        subtitle: "An example author project",
        imprint: "Example Press\nA neutral development proof",
      },
      entries: [
        {
          id: "opening",
          role: "front-matter",
          path: `${folder}/Book/Preface.md`,
        },
        { id: "part-one", role: "part", title: "The journey" },
        {
          id: "chapter-one",
          role: "chapter",
          path: `${folder}/Book/Chapter one.md`,
        },
        { id: "scene", role: "scene", path: `${folder}/Book/Scene.md` },
        {
          id: "chapter-two",
          role: "chapter",
          path: `${folder}/Book/Chapter two.md`,
        },
        {
          id: "closing",
          role: "back-matter",
          path: `${folder}/Book/Afterword.md`,
        },
      ],
    }),
  );
  put("Assets/Landscape.png", fixturePng(960, 480));
  put("Assets/Portrait.jpg", fixtureJpeg());
  put(
    "Formatting/Tables and images.md",
    `---\ndocument: plain\ntitle: Tables and images\nauthor: Alex Example\nlanguage: en-GB\n---\n\n# A small table\n\n| Item | Description | Amount |\n| :--- | :---: | ---: |\n| **North** | Longer text wraps inside its cell. | 12.50 |\n| South | A literal pipe: left \\| right and \`a < b\`. | 3.00 |\n| Blank | | 0.00 |\n| Image | ![[${folder}/Assets/Landscape.png\\|150x80]] | 2.00 |\n\n# Landscape and portrait\n\n![Blue and gold panels](${encodeURI(folder)}/Assets/Landscape.png)\n\n![Neutral portrait pattern](${encodeURI(folder)}/Assets/Portrait.jpg)\n\n# A wide table\n\n| A | B | C | D | E | F | G |\n| --- | --- | --- | --- | --- | --- | --- |\n| One | Two | Three | Four | Five | Six | Seven |\n\n# Literal code\n\n\`\`\`text\n  indent = true\n  #image("not-fetched.png")\n  a_very_long_identifier_abcdefghijklmnopqrstuvwxyz0123456789_ends_here\n\`\`\`\n\n# Lists and quotes\n\n3. Start at three.\n4. Continue at four.\n   - A nested bullet.\n\n> A quotation that should remain readable.\n\n# Heading links\n\n[Return to the small table](#a-small-table). EPUB keeps this destination live; PDF/DOCX use a label.\n`,
  );
  put(
    "Formatting/Long table.md",
    `---\ndocument: plain\ntitle: A table across pages\nauthor: Alex Example\n---\n\n| Record | Detail | State |\n| --- | --- | --- |\n${Array.from({ length: 80 }, (_, i) => `| Record ${i + 1} | A neutral row that must stay present across page breaks. | Complete |`).join("\n")}\n\nEND OF TABLE\n`,
  );
  for (const [name, body] of Object.entries({
    "Missing image": "![Missing](missing.png)",
    "Remote image": "![Remote](https://example.invalid/not-fetched.png)",
    "Unsupported image": "![[image.svg]]",
    "Broken ebook link": "# One\n\n[Missing](#two)",
    "Extra table cell": "| One |\n| --- |\n| A | B |",
    "Empty note": "",
  }))
    put(
      `Expected errors/${name}.md`,
      `---\ndocument: plain\ntitle: ${name}\nlanguage: en-GB\n---\n\n${body}\n`,
    );
  put(
    "Customise/Letter starter.md",
    "---\ndocument: letter\ntitle: '{{title}}'\nlanguage: en-GB\n---\n\nDear Editor,\n\nThank you for reading {{title}}.\n\nKind regards,\n\n{{sender-name}}\n",
  );
  for (const [source, target] of [
    ["neutral-pack", "Example output styles.json"],
    ["neutral-book", "Example book design.json"],
  ]) {
    put(
      `Customise/${target}`,
      await readFile(
        new URL(
          `../examples/${source}/page-foundry-pack.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
  files.set(
    "Start here.md",
    `# Try Page Foundry\n\n<!-- page-foundry-examples: 2 -->\n\nThis guide follows development main, which can be ahead of the published BRAT beta. Updating examples does not update the installed plugin. Save pending edits and fully reload Obsidian after external example updates; reloading only the plugin is not enough. If an example says Cannot open, reload before changing or deleting any notes.\n\nCreate author documents and books from reusable Markdown, not just a printout of the current screen. Start with the short path below; change one option at a time.\n\n## 1. A letter\n\nOpen [[${folder}/Writing/Letter]]. Run **Page Foundry: Edit document details** and check the readable addresses. Cancel first, reopen, then save a small change. Publish as Letter PDF. The greeting and signature should appear once. Publishing creates a local file; it does not send the letter.\n\n## 2. A manuscript\n\nOpen [[${folder}/Writing/Manuscript]]. Publish Manuscript PDF, then General manuscript DOCX. Check title page, double spacing, running title and body numbering. Try A4 and US Letter. In Publish, edit the file name, destination and an export-only title. Open Change layout and cancel: the same review and choices should remain. Repeat through More layouts, then choose a layout. Compatible details should carry over, with the new design's page defaults. Publish again should remember the successful design. A publisher's specific rules still take precedence.\n\n## 3. A book from separate chapters\n\nOpen [[${folder}/Book/Reading order.book]]. Edit document details to inspect opening pages, part, chapters, scene and closing pages. Publish PDF and EPUB; test EPUB contents and the chapter link. Export DOCX for continued editing. Chapter sources must stay unchanged.\n\n## 4. A paperback proof\n\nOn the same book, Change layout → Paperback. Test 5 × 8, 5.5 × 8.5 and 6 × 9 inches; vary white/cream paper and right-hand/next-page chapter starts. Inspect the proof report and PDF. This short example is intentionally below retailer page-count requirements: a page-count warning is expected, not certification or a failure.\n\n## 5. Formatting checks\n\nOpen [[${folder}/Formatting/Tables and images]] and [[${folder}/Formatting/Long table]]. Export PDF, EPUB and DOCX. Check table alignment, wrapped cells, all 80 records, repeating PDF headings, image proportions, code indentation and numbered-list starts. Wide PDF tables use stacked label/value rows. Remote/SVG images and rendered HTML are not supported.\n\n## 6. Your designs and reusable starting notes\n\n**Manage designs → Book designs**: use the existing configured neutral pack, or create a NEW pack at a new exact path. Never overwrite your retained designs. Try Duplicate, Create proof without saving, Save, then Publish the book twice.\n\nOptional ready-made examples are **${folder}/Customise/Example book design.json** and **${folder}/Customise/Example output styles.json**. Page Foundry currently selects one output pack at a time; record your existing path before temporarily selecting one. Restore it afterwards. These neutral copies contain no private designs.\n\nRegister **${folder}/Customise/Letter starter.md** under Private note templates in settings. Create new note should offer it. Also try Save as note template on a neutral note. Removing a registration must not delete its file.\n\n## 7. Create and recent choices\n\nRun Create new note: Letter, Submission letter, Manuscript, Book and Plain document are available directly, alongside registered templates. Enter a title; the filename should follow. File location (optional) lets you choose another filename or folder. Once you edit the filename, changing the title must not override it. Use an existing folder such as **${folder}/Writing** or enable Create missing folders deliberately. Do not create on top of an existing file. Create recent should offer used starters without changing the currently open note. Book details manage chapter order rather than replacing prose.\n\n## 8. Saving and offline use\n\nCheck your current output folder in settings before export. Save twice: existing files must not be overwritten. Use Show in folder on Mac; EPUB/DOCX may not appear in Obsidian's sidebar. Share or save elsewhere depends on the host's Files/share capability. Try Files/iCloud/Dropbox on a physical device when available. Repeat with network off after downloading plugin, notes and attachments.\n\n## 9. Expected errors\n\nThe **${folder}/Expected errors** folder contains deliberately broken examples. Missing/remote/SVG images, extra table cells and an empty note must block creation with a useful message. A broken heading link blocks EPUB; PDF/DOCX explain that it is a plain label. Never use real manuscript data in a public bug report.\n\n## Change document type\n\nOpen Edit document details → Document type. Switch between Plain document, Letter, Submission letter and Manuscript. Enter a field, switch away and back, then Cancel first: nothing should change. Repeat and Save details. Writing and existing properties must remain; Publish should now suggest the new type's default design. No starter text is inserted. Books remain separate reading-order plans: create a Book, then add the note through its details editor.\n\n## What to report\n\nRecord the example, format/design, device and expected versus actual result. Mark steps Not tested when unavailable. These are neutral local examples, not retailer or physical-device acceptance. Your previous notes and exports have a private recovery copy outside this vault; plugin settings and registered templates/designs were retained.\n`,
  );
  return files;
}
