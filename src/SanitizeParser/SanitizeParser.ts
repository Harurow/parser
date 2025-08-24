/**
 * SanitizeParser - htmlparser2のTokenizerを利用したHTMLパーサー
 *
 * 特徴:
 * - htmlparser2のTokenizerを使用
 * - より細かい制御が可能
 * - 閉じタグの自動生成を回避
 */

import Tokenizer, { Callbacks, QuoteType } from './Tokenizer';

// htmlparser2のTokenizerは直接使用できないため、シンプルな実装を提供

interface AllowedTag {
  tagName: string;
  onAttribute?: (attributeName: string, attributeValue: string) => boolean;
  defaultAttributes?: { [key: string]: string };
}

/** パーサー設定のオプション */
export interface SanitizeOptions {
  allowedTags?: AllowedTag[];  // 許可するタグと属性
}

/** パース結果 */
export interface SanitizeResult {
  /** HTML文字列 */
  html: string;
}

interface TokenText {
  tokenType: 'text';
  start: number;
  end: number;
}

interface TokeOpenTag {
  tokenType: 'openTag';
  start: number;
  end: number;
  tagName: string;
  atttributes: TagAttribute[];
}

interface TokenSelfCloseTag {
  tokenType: 'selfClosingTag';
  start: number;
  end: number;
  tagName: string;
  atttributes: TagAttribute[];
}

interface TokenCloseTag {
  tokenType: 'closeTag';
  start: number;
  end: number;
  tagName: string;
}

interface TagAttribute {
  name: string;
  value: string;
  QuteType: QuoteType;
}

type Token = TokenText | TokeOpenTag | TokenSelfCloseTag | TokenCloseTag;

const escapeText = (str: string): string => {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
};

/**
 * HTMLパーサークラス
 */
export class SanitizeParser {
  private options: SanitizeOptions;

  constructor(options?: SanitizeOptions) {
    this.options = options || {};
  }

  /**
   * HTMLをパースする
   */
  public sanitize(htmlText: string): SanitizeResult {
    const buffer = htmlText;
    let secsionStartIndex = 0;
    let tokens: Token[] = [];
    let tagStartIndex = -1;
    let tagName = '';
    let tagAttributes: TagAttribute[] = [];
    let attribName = '';
    let attribValue = '';

    console.log('--- sanitize start ---');

    const callbacks: Callbacks = {
      ontext: (start: number, end: number) => {
        tokens.push({ tokenType: 'text', start, end });
        console.log('onText:', {start, end, secsionStartIndex});
        secsionStartIndex = end + 1;
      },
      onopentagname: (start: number, end: number) => {
        tagStartIndex = start - 1; // '<'の位置
        tagName = buffer.slice(start, end);
        secsionStartIndex = start - 1;  // '<'の位置

        console.log('onOpenTagName:', {start, end, tagName});
      },
      onopentagend: (end: number) => {
        tokens.push({
          tokenType: 'openTag',
          start: tagStartIndex,
          end: end + 1, // '>'の次の位置
          tagName,
          atttributes: tagAttributes
        });

        console.log('onOpenTag:', {
          tagName: tagName,
          start: tagStartIndex,
          end: end + 1,
          text: buffer.slice(tagStartIndex, end + 1),
          attributes: tagAttributes
        });

        tagStartIndex = -1;
        tagName = '';
        tagAttributes = [];
        secsionStartIndex = end + 2; // '>'の次の位置
      },
      onselfclosingtag: function (end: number): void {
        tokens.push({
          tokenType: 'selfClosingTag',
          start: tagStartIndex,
          end: end + 1, // '/>'の次の位置
          tagName,
          atttributes: tagAttributes
        });

        console.log('onSelfClosingTag:', {
          tagName: tagName,
          start: tagStartIndex,
          end: end + 1,
          text: buffer.slice(tagStartIndex, end + 1),
          attributes: tagAttributes
        });

        tagStartIndex = -1;
        tagName = '';
        tagAttributes = [];
        secsionStartIndex = end + 2; // '>'の次の位置
      },
      onattribname: (start: number, end: number) => {
        const text = buffer.slice(start, end);
        attribName = text;
        attribValue = '';

        console.log('onAttributeName:', {start, end, text});
      },
      onattribdata: (start: number, end: number) => {
        const text = buffer.slice(start, end);
        attribValue += text;

        console.log('onAttirubteData:', {start, end, text});
      },
      onattribend: (quote: QuoteType, end: number) => {
        const tagAttrib: TagAttribute = {
          name: attribName,
          value: attribValue,
          QuteType: quote
        };
        tagAttributes.push(tagAttrib);
        attribName = '';
        attribValue = '';

        console.log('onAttirubteEnd:', {tagAttrib});
      },
      onclosetag: (start: number, end: number) => {
        const tagName = buffer.slice(start, end);

        const GtCharCode = 0x3e; // '>'
        const fastForwardToGt = (): boolean => {
            while (++end < buffer.length) {
                if (buffer.charCodeAt(end) === GtCharCode) {
                    return true;
                }
            }

            end = buffer.length  - 1;

            return false;
        }

        if (buffer.charCodeAt(end) === GtCharCode || fastForwardToGt()) {
          tokens.push({
            tokenType: 'closeTag',
            start: secsionStartIndex, // '</'の位置
            end: end + 1, // '>'の次の位置
            tagName,
          });

          console.log('onCloseTag:', {start: secsionStartIndex, end, tagName});
          secsionStartIndex = end + 1;
        } else {
          // タグが閉じていないので文字扱い
          callbacks.ontext(secsionStartIndex, end);
          console.log('onCloseTag but not closed');
          secsionStartIndex = buffer.length;
        }
      },
      onend: function (): void {
        if (secsionStartIndex < buffer.length) {
          // 残りのテキストを処理
          callbacks.ontext(secsionStartIndex, buffer.length);
          console.log('onEnd with flashText');
        } else {
          console.log('onEnd');
        }
        console.log('--- sanitize end ---');
      },
    };

    const tokenizer = new Tokenizer(callbacks);
    tokenizer.parse(htmlText);

    let sanitizedText = '';
    tokens.forEach(token => {
      if (token.tokenType === 'text') {
        const text = buffer.slice(token.start, token.end);
        const sanitized = escapeText(text);
        sanitizedText += sanitized;
      } else if (token.tokenType === 'openTag' || token.tokenType === 'selfClosingTag') {
        const allowedTag = this.options.allowedTags?.find(t => t.tagName.toLowerCase() === token.tagName.toLowerCase());
        if (allowedTag) {
          let tagString = `<${token.tagName}`;
          // 属性の処理
          token.atttributes.forEach(attr => {
            if (allowedTag.onAttribute) {
              if (allowedTag.onAttribute(attr.name, attr.value)) {
                tagString += ` ${attr.name}="${escapeText(attr.value)}"`;
              }
            }
          });
          // デフォルト属性の追加
          if (allowedTag.defaultAttributes) {
            for (const [attrName, attrValue] of Object.entries(allowedTag.defaultAttributes)) {
              if (!token.atttributes.find(a => a.name === attrName)) {
                tagString += ` ${attrName}="${escapeText(attrValue)}"`;
              }
            }
          }
          if (token.tokenType === 'selfClosingTag') {
            tagString += ' />';
          } else {
            tagString += '>';
          }
          sanitizedText += tagString;
        } else {
          // 許可されていないタグは文字列扱い
          const text = buffer.slice(token.start, token.end);
          sanitizedText += escapeText(text);
        }
      } else if (token.tokenType === 'closeTag') {
        const allowedTag = this.options.allowedTags?.find(t => t.tagName.toLowerCase() === token.tagName.toLowerCase());
        if (allowedTag) {
          sanitizedText += `</${token.tagName}>`;
        } else {
          // 許可されていないタグは文字列扱い
          const text = buffer.slice(token.start, token.end);
          sanitizedText += escapeText(text);
        }
      }
    });

    return {
      html: sanitizedText
    };
  }
}

// デフォルトエクスポート
export default SanitizeParser;
