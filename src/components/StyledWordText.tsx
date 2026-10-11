import React from 'react';
import { WordStyle } from '../contexts/TypographyContext';

interface StyledWordTextProps {
  words: WordStyle[];
  className?: string;
  style?: React.CSSProperties;
  fontSize?: number;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div';
}

export const StyledWordText: React.FC<StyledWordTextProps> = ({
  words,
  className = '',
  style = {},
  fontSize,
  as: Component = 'span',
}) => {
  const inlineStyle: React.CSSProperties = {
    ...style,
    ...(fontSize ? { fontSize: `${fontSize}px` } : {}),
  };

  const isCentered = className.includes('text-center') || className.includes('justify-center');
  const isBlock = Component !== 'span';
  const flexClass = isBlock
    ? `flex flex-wrap items-baseline ${isCentered ? 'justify-center' : ''}`
    : `inline-flex flex-wrap items-baseline ${isCentered ? 'justify-center' : ''}`;

  return (
    <Component className={`${flexClass} ${className}`} style={inlineStyle}>
      {words.map((w, wordIndex) => {
        const isLetterMode = w.colorMode === 'letter';

        return (
          <span
            key={`${w.word}-${wordIndex}`}
            className="inline-block align-baseline"
            style={{
              color: !isLetterMode ? w.wordColor : undefined,
              marginRight: wordIndex < words.length - 1 ? '0.28em' : undefined,
            }}
          >
            {isLetterMode ? (
              Array.from(w.word).map((char, charIndex) => {
                const charColor =
                  w.letterColors && w.letterColors[charIndex]
                    ? w.letterColors[charIndex]
                    : w.wordColor || 'inherit';

                return (
                  <span
                    key={`${char}-${charIndex}`}
                    style={{ color: charColor }}
                    className="inline-block align-baseline transition-colors duration-150"
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                );
              })
            ) : (
              w.word
            )}
          </span>
        );
      })}
    </Component>
  );
};
