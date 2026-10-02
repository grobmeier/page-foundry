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
  PageBreak,
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
  RenderStyle,
} from "../core/model";
import { imageSize, requireImage } from "../core/images";
import { safeExternalHref } from "../core/headings";

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
    const sections: ISectionOptions[] =
      manuscript || source.book
        ? [
            {
              properties: { page: pageProperties(profile, source.style) },
              children: titlePage(source),
            },
            {
              properties: {
                page: {
                  ...pageProperties(profile, source.style),
                  pageNumbers: { start: 1 },
                },
                type: SectionType.NEXT_PAGE,
              },
              headers: header ? { default: header } : undefined,
              children: body,
            },
          ]
        : [
            {
              properties: { page: pageProperties(profile, source.style) },
              children: [titleParagraph(source.title), ...body],
            },
          ];
    const doc = new Document({
      creator: source.metadata.author,
      title: source.title,
      description: "Created locally with Page Foundry",
      styles: {
        default: {
          document: {
            run: {
              font: source.style?.font,
              size:
                source.style?.bodySizePt === undefined
                  ? undefined
                  : source.style.bodySizePt * 2,
              color: source.style?.color?.slice(1),
            },
            paragraph: {
              spacing:
                source.style?.lineSpacing === undefined
                  ? undefined
                  : {
                      line: Math.round(source.style.lineSpacing * 240),
                      lineRule: LineRuleType.AUTO,
                    },
            },
          },
        },
      },
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

function pageProperties(
  profile: PageProfileId,
  style?: RenderStyle,
): {
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
      top: Math.round(((style?.marginYmm ?? 25.4) * 1440) / 25.4),
      right: Math.round(((style?.marginXmm ?? 25.4) * 1440) / 25.4),
      bottom: Math.round(((style?.marginYmm ?? 25.4) * 1440) / 25.4),
      left: Math.round(((style?.marginXmm ?? 25.4) * 1440) / 25.4),
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
          ...manuscriptTextOptions(source.style),
        }),
      ],
    }),
    ...(author
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [manuscriptRun(author, source.style)],
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
          manuscriptRun(`${label} / `, source.style),
          new TextRun({
            children: [PageNumber.CURRENT],
            ...manuscriptTextOptions(source.style),
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
          spacing: manuscript
            ? manuscriptSpacing(source.style)
            : { after: 240 },
          children: renderInline(block.children, {}, manuscript, source),
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          spacing: manuscript
            ? manuscriptSpacing(source.style)
            : { after: 160 },
          indent: manuscript ? { firstLine: 720 } : undefined,
          children: renderInline(block.children, {}, manuscript, source),
        }),
      ];
    case "blockquote":
      return block.blocks.flatMap((child) =>
        child.type === "paragraph"
          ? [
              new Paragraph({
                spacing: manuscript
                  ? manuscriptSpacing(source.style)
                  : { after: 160 },
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
    case "page-break":
      return [new Paragraph({ children: [new PageBreak()] })];
    case "thematic-break":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: manuscript
            ? manuscriptSpacing(source.style)
            : { after: 160 },
          children: [
            manuscript
              ? manuscriptRun("* * *", source.style)
              : new TextRun("* * *"),
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
      spacing: manuscript ? manuscriptSpacing(source.style) : { after: 80 },
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
        return [textRun(node.value, style, manuscript, source.style)];
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
        return [
          textRun(
            node.value,
            { ...style, code: true },
            manuscript,
            source.style,
          ),
        ];
      case "link": {
        const children = renderInline(node.children, style, manuscript, source);
        return safeExternalHref(node.url)
          ? [new ExternalHyperlink({ link: node.url, children })]
          : children;
      }
      case "break":
        return [
          new TextRun({
            text: "",
            break: 1,
            ...(manuscript ? manuscriptTextOptions(source.style) : {}),
          }),
        ];
      case "image": {
        const image = requireImage(source, node);
        return [
          new ImageRun({
            type: image.extension,
            data: image.bytes,
            transformation: imageSize(
              image,
              node.width,
              Math.min(
                480,
                ((210 - 2 * (source.style?.marginXmm ?? 25.4) - 25) * 96) /
                  25.4,
              ),
              Math.min(
                600,
                ((279.4 - 2 * (source.style?.marginYmm ?? 25.4) - 25) * 96) /
                  25.4,
              ),
            ),
            altText: { name: image.id, description: node.alt, title: node.alt },
          }),
        ];
      }
    }
  });
}

function textRun(
  text: string,
  style: TextStyle,
  manuscript: boolean,
  layout?: RenderStyle,
): TextRun {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    font: style.code
      ? "Courier New"
      : manuscript
        ? (layout?.font ?? "Times New Roman")
        : undefined,
    size: manuscript ? (layout?.bodySizePt ?? 12) * 2 : undefined,
    color: manuscript ? (layout?.color?.slice(1) ?? "000000") : undefined,
  });
}

function manuscriptRun(text: string, style?: RenderStyle): TextRun {
  return new TextRun({ text, ...manuscriptTextOptions(style) });
}

function manuscriptTextOptions(style?: RenderStyle): {
  font: string;
  size: number;
  color: string;
} {
  return {
    font: style?.font ?? "Times New Roman",
    size: (style?.bodySizePt ?? 12) * 2,
    color: style?.color?.slice(1) ?? "000000",
  };
}

function manuscriptSpacing(style?: RenderStyle): {
  line: number;
  lineRule: (typeof LineRuleType)[keyof typeof LineRuleType];
  after: number;
} {
  return {
    line: Math.round((style?.lineSpacing ?? 2) * 240),
    lineRule: LineRuleType.AUTO,
    after: 0,
  };
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
