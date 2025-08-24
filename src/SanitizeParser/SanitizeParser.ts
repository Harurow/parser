/**
 * SanitizeParser - 独自実装のTokenizerを利用したHTMLサニタイズパーサー
 *
 * 特徴:
 * - 独自実装のTokenizerでHTMLをトークン化
 * - より細かい制御が可能
 * - 閉じタグの自動生成を回避
 */

import Tokenizer, { Callbacks, QuoteType } from "./Tokenizer";

// htmlparser2のTokenizerを参考にした独自実装を利用

/**
 * 許可するタグ情報
 */
export interface AllowedTag {
  /** タグ名 */
  tagName: string;
  /** 属性フィルタ関数 */
  onAttribute?: (attributeName: string, attributeValue: string) => boolean;
  /** デフォルト属性 */
  defaultAttributes?: { [key: string]: string };
}

/** パーサー設定のオプション */
/**
 * サニタイズオプション
 */
export interface SanitizeOptions {
  /** 許可するタグと属性 */
  allowedTags?: AllowedTag[];
}

/**
 * テキストトークン
 */
interface TokenText {
  tokenType: "text";
  start: number;
  end: number;
}

/**
 * 開始タグトークン
 */
interface TokeOpenTag {
  tokenType: "openTag";
  start: number;
  end: number;
  tagName: string;
  atttributes: TagAttribute[];
}

/**
 * 自己終了タグトークン
 */
interface TokenSelfCloseTag {
  tokenType: "selfClosingTag";
  start: number;
  end: number;
  tagName: string;
  atttributes: TagAttribute[];
}

/**
 * 閉じタグトークン
 */
interface TokenCloseTag {
  tokenType: "closeTag";
  start: number;
  end: number;
  tagName: string;
}

/**
 * タグ属性情報
 */
interface TagAttribute {
  /** 属性名 */
  name: string;
  /** 属性値 */
  value: string;
  /** クォート種別 */
  QuteType: QuoteType;
}

/**
 * トークン型
 */
type Token = TokenText | TokeOpenTag | TokenSelfCloseTag | TokenCloseTag;

/**
 * テキストをHTMLエスケープする
 * @param str 入力文字列
 * @returns エスケープ済み文字列
 */
const escapeText = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * HTMLをパースしてサニタイズする
 * @param htmlText 入力HTML文字列
 * @returns サニタイズ結果
 */
export function sanitizeHtml(
  htmlText: string,
  options?: SanitizeOptions
): string {
  options = options || {};
  const buffer = htmlText;
  let tokens: Token[] = [];
  let tagName = "";
  let tagAttributes: TagAttribute[] = [];
  let attribName = "";
  let attribValue = "";
  let endIndex = 0;

  /**
   * Tokenizerコールバック群
   */
  const callbacks: Callbacks = {
    /** テキスト検出時 */
    ontext: (start: number, end: number) => {
      const token: TokenText = { tokenType: "text", start, end };
      tokens.push(token);
      endIndex = token.end;
    },
    /** 開始タグ名検出時 */
    onopentagname: (start: number, end: number) => {
      tagName = buffer.slice(start, end);
    },
    /** 開始タグ終了時 */
    onopentagend: (end: number, tagStart: number, tagEnd: number) => {
      const token: TokeOpenTag = {
        tokenType: "openTag",
        start: tagStart,
        end: tagEnd + 1, // '>'の次の位置
        tagName,
        atttributes: tagAttributes,
      };
      tokens.push(token);
      endIndex = token.end;
      // タグ名・属性リセット
      tagName = "";
      tagAttributes = [];
    },
    /** 自己終了タグ検出時 */
    onselfclosingtag: function (
      end: number,
      tagStart: number,
      tagEnd: number
    ): void {
      const token: TokenSelfCloseTag = {
        tokenType: "selfClosingTag",
        start: tagStart,
        end: tagEnd + 1, // '>'の次の位置
        tagName,
        atttributes: tagAttributes,
      };
      tokens.push(token);
      endIndex = token.end;
      // タグ名・属性リセット
      tagName = "";
      tagAttributes = [];
    },
    /** 閉じタグ検出時 */
    onclosetag: (
      start: number,
      end: number,
      tagStart: number,
      tagEnd: number
    ) => {
      tagName = buffer.slice(start, end);
      const token: TokenCloseTag = {
        tokenType: "closeTag",
        start: tagStart,
        end: tagEnd + 1, // '>'の次の位置
        tagName,
      };
      tokens.push(token);
      endIndex = token.end;
    },
    /** 属性名検出時 */
    onattribname: (start: number, end: number) => {
      const text = buffer.slice(start, end);
      attribName = text;
      attribValue = "";
    },
    /** 属性値検出時 */
    onattribdata: (start: number, end: number) => {
      const text = buffer.slice(start, end);
      attribValue += text;
    },
    /** 属性終了時 */
    onattribend: (quote: QuoteType, end: number) => {
      const tagAttrib: TagAttribute = {
        name: attribName,
        value: attribValue,
        QuteType: quote,
      };
      tagAttributes.push(tagAttrib);
      attribName = "";
      attribValue = "";
    },
    /** パース終了時 */
    onend: function (): void {
      // 残りのテキストがあれば追加
      if (endIndex < buffer.length) {
        callbacks.ontext(endIndex, buffer.length);
      }
    },
  };

  // TokenizerでHTMLをトークン化
  const tokenizer = new Tokenizer(callbacks);
  tokenizer.parse(htmlText);

  let sanitizedText = "";
  // トークンごとにサニタイズ処理
  tokens.forEach((token) => {
    // テキストの場合はエスケープ
    if (token.tokenType === "text") {
      const text = buffer.slice(token.start, token.end);
      const sanitized = escapeText(text);
      sanitizedText += sanitized;
    }
    // 開始タグ・自己終了タグの場合
    else if (
      token.tokenType === "openTag" ||
      token.tokenType === "selfClosingTag"
    ) {
      // 許可タグか判定
      const allowedTag = options.allowedTags?.find(
        (t) => t.tagName.toLowerCase() === token.tagName.toLowerCase()
      );
      if (allowedTag) {
        let tagString = `<${token.tagName}`;
        // 属性ごとに許可判定
        token.atttributes.forEach((attr) => {
          if (allowedTag.onAttribute) {
            // 属性が許可されている場合のみ追加
            if (allowedTag.onAttribute(attr.name.toLowerCase(), attr.value)) {
              tagString += ` ${attr.name}="${escapeText(attr.value)}"`;
            }
          }
        });
        // デフォルト属性の追加
        if (allowedTag.defaultAttributes) {
          for (const [attrName, attrValue] of Object.entries(
            allowedTag.defaultAttributes
          )) {
            // 既存属性に含まれていなければ追加
            if (!token.atttributes.find((a) => a.name === attrName)) {
              tagString += ` ${attrName}="${escapeText(attrValue)}"`;
            }
          }
        }
        // 自己終了タグか判定
        if (token.tokenType === "selfClosingTag") {
          tagString += " />";
        } else {
          tagString += ">";
        }
        sanitizedText += tagString;
      } else {
        // 許可されていないタグはエスケープしてテキスト扱い
        const text = buffer.slice(token.start, token.end);
        sanitizedText += escapeText(text);
      }
    }
    // 閉じタグの場合
    else if (token.tokenType === "closeTag") {
      // 許可タグか判定
      const allowedTag = options.allowedTags?.find(
        (t) => t.tagName.toLowerCase() === token.tagName.toLowerCase()
      );
      if (allowedTag) {
        sanitizedText += `</${token.tagName}>`;
      } else {
        // 許可されていないタグはエスケープしてテキスト扱い
        const text = buffer.slice(token.start, token.end);
        sanitizedText += escapeText(text);
      }
    }
  });

  return sanitizedText;
}

/**
 * デフォルトエクスポート
 */
export default sanitizeHtml;
