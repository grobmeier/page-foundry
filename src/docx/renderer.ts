/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Header,
  ImageRun,
  HeadingLevel,
  LevelFormat,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  TextRun,
  type ISectionOptions,
  type ParagraphChild,
} from "docx";
import type {
  BlockNode,
  DocxPresetId,
  FoundryDocument,
  InlineNode,
  PageProfileId,
  PublishedFile,
} from "../core/model";
import { imageSize, requireImage } from "../core/images";

interface TextStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
}

export class DocxRenderer {
  async render(
    source: FoundryDocument,
    preset: DocxPresetId,
    profile: PageProfileId,
  ): Promise<PublishedFile> {
    const manuscript = preset === "general-manuscript";
    const body = source.blocks.flatMap((block) =>
      renderBlock(block, manuscript, source),
    );
    const header = manuscript ? manuscriptHeader(source) : undefined;
    const sections: ISectionOptions[] = manuscript
      ? [
          {
            properties: { page: pageProperties(profile) },
            children: titlePage(source),
          },
          {
            properties: {
              page: { ...pageProperties(profile), pageNumbers: { start: 1 } },
              type: SectionType.NEXT_PAGE,
            },
            headers: header ? { default: header } : undefined,
            children: body,
          },
        ]
      : [
          {
            properties: { page: pageProperties(profile) },
            children: [titleParagraph(source.title), ...body],
          },
        ];
    const doc = new Document({
      creator: source.metadata.author,
      title: source.title,
      description: "Created locally with Page Foundry",
      numbering: {
        config: [
          {
            reference: "page-foundry-numbering",
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      },
      sections,
    });
    const blob = await Packer.toBlob(doc);
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      extension: "docx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
}

function pageProperties(profile: PageProfileId): {
  size: { width: number; height: number };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    header: number;
    footer: number;
    gutter: number;
  };
} {
  return {
    size: pageSize(profile),
    margin: {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440,
      header: 720,
      footer: 720,
      gutter: 0,
    },
  };
}

function pageSize(profile: PageProfileId): { width: number; height: number } {
  return profile === "a4"
    ? { width: 11_906, height: 16_838 }
    : { width: 12_240, height: 15_840 };
}

function titlePage(source: FoundryDocument): Paragraph[] {
  const author = source.metadata.author;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4320, after: 480 },
      children: [
        new TextRun({
          text: source.title,
          bold: true,
          ...manuscriptTextOptions(),
        }),
      ],
    }),
    ...(author
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [manuscriptRun(author)],
          }),
        ]
      : []),
  ];
}

function titleParagraph(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
    children: [new TextRun({ text: title, bold: true, size: 36 })],
  });
}

function manuscriptHeader(source: FoundryDocument): Header | undefined {
  const author = source.metadata.author;
  const surname =
    source.metadata.surname ?? author?.trim().split(/\s+/u).at(-1);
  const shortTitle = source.metadata["short-title"] ?? source.title;
  if (!surname && !shortTitle) return undefined;
  const label = [surname, shortTitle].filter(Boolean).join(" / ");
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          manuscriptRun(`${label} / `),
          new TextRun({
            children: [PageNumber.CURRENT],
            ...manuscriptTextOptions(),
          }),
        ],
      }),
    ],
  });
}

function renderBlock(
  block: BlockNode,
  manuscript: boolean,
  source: FoundryDocument,
): Paragraph[] {
  switch (block.type) {
    case "heading":
      return [
        new Paragraph({
          heading: headingLevel(block.depth),
          keepNext: true,
          spacing: manuscriptSpacing(),
          children: renderInline(block.children, {}, manuscript, source),
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          spacing: manuscript ? manuscriptSpacing() : { after: 160 },
          indent: manuscript ? { firstLine: 720 } : undefined,
          children: renderInline(block.children, {}, manuscript, source),
        }),
      ];
    case "blockquote":
      return block.blocks.flatMap((child) =>
        child.type === "paragraph"
          ? [
              new Paragraph({
                spacing: manuscript ? manuscriptSpacing() : { after: 160 },
                indent: { left: 720, right: 720 },
                children: renderInline(
                  child.children,
                  { italics: true },
                  manuscript,
                  source,
                ),
              }),
            ]
          : renderBlock(child, manuscript, source),
      );
    case "list":
      return block.items.flatMap((item) =>
        item.flatMap((child) =>
          renderListItem(child, manuscript, block.ordered, source),
        ),
      );
    case "thematic-break":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: manuscript ? manuscriptSpacing() : { after: 160 },
          children: [
            manuscript ? manuscriptRun("* * *") : new TextRun("* * *"),
          ],
        }),
      ];
  }
}

function renderListItem(
  block: BlockNode,
  manuscript: boolean,
  ordered: boolean,
  source: FoundryDocument,
): Paragraph[] {
  if (block.type !== "paragraph") return renderBlock(block, manuscript, source);
  return [
    new Paragraph({
      spacing: manuscript ? manuscriptSpacing() : { after: 80 },
      ...(ordered
        ? { numbering: { reference: "page-foundry-numbering", level: 0 } }
        : { bullet: { level: 0 } }),
      children: renderInline(block.children, {}, manuscript, source),
    }),
  ];
}

function renderInline(
  nodes: InlineNode[],
  style: TextStyle,
  manuscript: boolean,
  source: FoundryDocument,
): ParagraphChild[] {
  return nodes.flatMap((node): ParagraphChild[] => {
    switch (node.type) {
      case "text":
        return [textRun(node.value, style, manuscript)];
      case "emphasis":
        return renderInline(
          node.children,
          { ...style, italics: true },
          manuscript,
          source,
        );
      case "strong":
        return renderInline(
          node.children,
          { ...style, bold: true },
          manuscript,
          source,
        );
      case "inline-code":
        return [textRun(node.value, { ...style, code: true }, manuscript)];
      case "link": {
        const children = renderInline(node.children, style, manuscript, source);
        return safeExternalUrl(node.url)
          ? [new ExternalHyperlink({ link: node.url, children })]
          : children;
      }
      case "break":
        return [
          new TextRun({
            text: "",
            break: 1,
            ...(manuscript ? manuscriptTextOptions() : {}),
          }),
        ];
      case "image": {
        const image = requireImage(source, node);
        return [
          new ImageRun({
            type: image.extension,
            data: image.bytes,
            transformation: imageSize(image, node.width, 480, 600),
            altText: { name: image.id, description: node.alt, title: node.alt },
          }),
        ];
      }
    }
  });
}

function textRun(text: string, style: TextStyle, manuscript: boolean): TextRun {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    font: style.code
      ? "Courier New"
      : manuscript
        ? "Times New Roman"
        : undefined,
    size: manuscript ? 24 : undefined,
    color: manuscript ? "000000" : undefined,
  });
}

function manuscriptRun(text: string): TextRun {
  return new TextRun({ text, ...manuscriptTextOptions() });
}

function manuscriptTextOptions(): {
  font: string;
  size: number;
  color: string;
} {
  return { font: "Times New Roman", size: 24, color: "000000" };
}

function manuscriptSpacing(): {
  line: number;
  lineRule: (typeof LineRuleType)[keyof typeof LineRuleType];
  after: number;
} {
  return { line: 480, lineRule: LineRuleType.AUTO, after: 0 };
}

function headingLevel(
  depth: number,
): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  return [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ][
    Math.min(Math.max(depth, 1), 6) - 1
  ] as (typeof HeadingLevel)[keyof typeof HeadingLevel];
}

function safeExternalUrl(value: string): boolean {
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
