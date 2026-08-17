import { Fragment, ReactNode } from 'react';
import { parseChatMarkdown, parseInlineBold } from './chatMarkdown';

/**
 * Monta os blocos de parseChatMarkdown em elementos React de verdade (nunca
 * dangerouslySetInnerHTML) - a resposta vem de um LLM, entao montar via JSX
 * evita que qualquer coisa que o modelo eco'e vire HTML executavel.
 */
export function renderChatMarkdown(text: string): ReactNode {
  const blocks = parseChatMarkdown(text);

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'list') {
          return (
            <ol key={blockIndex} className="list-decimal space-y-1.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineSegments(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInlineSegments(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineSegments(text: string): ReactNode {
  return parseInlineBold(text).map((segment, index) =>
    segment.bold ? <strong key={index}>{segment.text}</strong> : <Fragment key={index}>{segment.text}</Fragment>
  );
}
