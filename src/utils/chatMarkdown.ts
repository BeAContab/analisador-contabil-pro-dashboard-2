/**
 * Parser minimo para o subconjunto de markdown que o prompt da IA (tess.ts)
 * garante que o modelo vai usar: paragrafos separados por linha em branco,
 * **negrito** inline e listas numeradas ("1. ", "2. "...). Nao ha bullets com
 * asterisco, links ou blocos de codigo no formato pedido, entao nao precisam
 * ser suportados aqui.
 *
 * Puramente textual (sem JSX) para poder ser testado com vitest como o resto
 * dos utils - a montagem em elementos React fica em chatMarkdown.tsx.
 */

export type ChatBlock = { type: 'paragraph'; lines: string[] } | { type: 'list'; items: string[] };

const orderedListItemRegex = /^\d+\.\s+(.*)$/;

export function parseChatMarkdown(text: string): ChatBlock[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks.map((block): ChatBlock => {
    const lines = block.split('\n').map((line) => line.trim());
    const listItems = lines.map((line) => line.match(orderedListItemRegex));

    if (listItems.every((match) => match !== null)) {
      return { type: 'list', items: listItems.map((match) => match![1] ?? '') };
    }

    return { type: 'paragraph', lines };
  });
}

export interface InlineSegment {
  text: string;
  bold: boolean;
}

const boldSegmentRegex = /\*\*(.+?)\*\*/g;

export function parseInlineBold(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(boldSegmentRegex)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex), bold: false });
    }
    segments.push({ text: match[1] ?? '', bold: true });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments;
}
