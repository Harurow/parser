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
 * HTMLエスケープ用の定数
 */
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} as const;

/**
 * HTMLエスケープ用の正規表現
 */
const HTML_ESCAPE_REGEX = /[&<>"']/g;

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
interface TokenOpenTag {
  tokenType: "openTag";
  start: number;
  end: number;
  tagName: string;
  attributes: TagAttribute[];
}

/**
 * 自己終了タグトークン
 */
interface TokenSelfCloseTag {
  tokenType: "selfClosingTag";
  start: number;
  end: number;
  tagName: string;
  attributes: TagAttribute[];
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
  quoteType: QuoteType;
}

/**
 * トークン型
 */
type Token = TokenText | TokenOpenTag | TokenSelfCloseTag | TokenCloseTag;

/**
 * テキストをHTMLエスケープする（最適化版）
 * @param str 入力文字列
 * @returns エスケープ済み文字列
 */
const escapeText = (str: string): string => {
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char as keyof typeof HTML_ESCAPE_MAP]);
};

/**
 * SanitizeParserクラス - HTMLサニタイズパーサー
 */
export class SanitizeParser {
  private options: SanitizeOptions;
  private allowedTagsMap: Map<string, AllowedTag>;

  constructor(options?: SanitizeOptions) {
    this.options = options || {};
    this.allowedTagsMap = this.buildAllowedTagsMap();
  }

  /**
   * 許可タグのMapを構築する（パフォーマンス最適化）
   * @returns 許可タグのMap
   */
  private buildAllowedTagsMap(): Map<string, AllowedTag> {
    const map = new Map<string, AllowedTag>();

    if (this.options.allowedTags) {
      this.options.allowedTags.forEach(tag => {
        map.set(tag.tagName.toLowerCase(), tag);
      });
    }

    return map;
  }

  /**
   * HTMLをパースしてサニタイズする
   * @param htmlText 入力HTML文字列
   * @returns サニタイズ結果オブジェクト
   */
  public sanitize(htmlText: string): { html: string } {
    try {
      // 入力検証と型変換
      if (typeof htmlText !== 'string') {
        console.warn('SanitizeParser: Input is not a string, converting to string');
        htmlText = String(htmlText);
      }

      // 空文字列の場合は早期リターン
      if (htmlText.length === 0) {
        return { html: '' };
      }

      const tokens = this.tokenizeHtml(htmlText);
      const sanitizedHtml = this.processTokens(tokens, htmlText);
      return { html: sanitizedHtml };
    } catch (error) {
      // エラーが発生した場合は入力をエスケープして返す
      console.warn('SanitizeParser error:', error);
      return { html: escapeText(String(htmlText)) };
    }
  }

  /**
   * HTMLをトークン化する
   * @param htmlText 入力HTML文字列
   * @returns トークン配列
   */
  private tokenizeHtml(htmlText: string): Token[] {
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
        const token: TokenOpenTag = {
          tokenType: "openTag",
          start: tagStart,
          end: tagEnd + 1, // '>'の次の位置
          tagName,
          attributes: tagAttributes,
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
          attributes: tagAttributes,
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
          quoteType: quote,
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

    return tokens;
  }

  /**
   * トークンを処理してサニタイズ済みHTMLを生成する
   * @param tokens トークン配列
   * @param buffer 元のHTML文字列
   * @returns サニタイズ済みHTML文字列
   */
  private processTokens(tokens: Token[], buffer: string): string {
    const result: string[] = [];

    tokens.forEach((token) => {
      if (token.tokenType === "text") {
        result.push(this.processTextToken(token, buffer));
      } else if (token.tokenType === "openTag" || token.tokenType === "selfClosingTag") {
        result.push(this.processTagToken(token, buffer));
      } else if (token.tokenType === "closeTag") {
        result.push(this.processCloseTagToken(token, buffer));
      }
    });

    return result.join("");
  }

  /**
   * テキストトークンを処理する
   * @param token テキストトークン
   * @param buffer 元のHTML文字列
   * @returns エスケープ済みテキスト
   */
  private processTextToken(token: TokenText, buffer: string): string {
    const text = buffer.slice(token.start, token.end);
    return escapeText(text);
  }

  /**
   * 開始タグ・自己終了タグトークンを処理する
   * @param token タグトークン
   * @param buffer 元のHTML文字列
   * @returns サニタイズ済みタグ文字列
   */
  private processTagToken(token: TokenOpenTag | TokenSelfCloseTag, buffer: string): string {
    const allowedTag = this.findAllowedTag(token.tagName);

    if (allowedTag) {
      return this.buildAllowedTag(token, allowedTag);
    } else {
      // 許可されていないタグはエスケープしてテキスト扱い
      const text = buffer.slice(token.start, token.end);
      return escapeText(text);
    }
  }

  /**
   * 閉じタグトークンを処理する
   * @param token 閉じタグトークン
   * @param buffer 元のHTML文字列
   * @returns サニタイズ済み閉じタグ文字列
   */
  private processCloseTagToken(token: TokenCloseTag, buffer: string): string {
    const allowedTag = this.findAllowedTag(token.tagName);

    if (allowedTag) {
      return `</${token.tagName}>`;
    } else {
      // 許可されていないタグはエスケープしてテキスト扱い
      const text = buffer.slice(token.start, token.end);
      return escapeText(text);
    }
  }

  /**
   * 許可されたタグを検索する（O(1)検索）
   * @param tagName タグ名
   * @returns 許可されたタグ情報またはundefined
   */
  private findAllowedTag(tagName: string): AllowedTag | undefined {
    return this.allowedTagsMap.get(tagName.toLowerCase());
  }

  /**
   * 許可されたタグの文字列を構築する
   * @param token タグトークン
   * @param allowedTag 許可されたタグ情報
   * @returns タグ文字列
   */
  private buildAllowedTag(token: TokenOpenTag | TokenSelfCloseTag, allowedTag: AllowedTag): string {
    let tagString = `<${token.tagName}`;

    // 属性の処理
    tagString += this.processAttributes(token.attributes, allowedTag);

    // デフォルト属性の追加
    tagString += this.addDefaultAttributes(token.attributes, allowedTag);

    // 自己終了タグか判定
    if (token.tokenType === "selfClosingTag") {
      tagString += " />";
    } else {
      tagString += ">";
    }

    return tagString;
  }

  /**
   * 属性を処理する
   * @param attributes 属性配列
   * @param allowedTag 許可されたタグ情報
   * @returns 属性文字列
   */
  private processAttributes(attributes: TagAttribute[], allowedTag: AllowedTag): string {
    let attributeString = "";

    attributes.forEach((attr) => {
      if (this.isAttributeAllowed(attr, allowedTag)) {
        if (attr.quoteType === QuoteType.NoValue) {
          // 値なし属性
          attributeString += ` ${attr.name}`;
        } else {
          // 値あり属性
          attributeString += ` ${attr.name}="${escapeText(attr.value)}"`;
        }
      }
    });

    return attributeString;
  }

  /**
   * 属性が許可されているかチェックする
   * @param attr 属性
   * @param allowedTag 許可されたタグ情報
   * @returns 許可されている場合true
   */
  private isAttributeAllowed(attr: TagAttribute, allowedTag: AllowedTag): boolean {
    if (allowedTag.onAttribute) {
      return allowedTag.onAttribute(attr.name.toLowerCase(), attr.value);
    } else {
      // onAttributeが指定されていない場合はすべての属性を許可
      return true;
    }
  }

  /**
   * デフォルト属性を追加する
   * @param existingAttributes 既存の属性配列
   * @param allowedTag 許可されたタグ情報
   * @returns デフォルト属性文字列
   */
  private addDefaultAttributes(existingAttributes: TagAttribute[], allowedTag: AllowedTag): string {
    let defaultAttributeString = "";

    if (allowedTag.defaultAttributes) {
      for (const [attrName, attrValue] of Object.entries(allowedTag.defaultAttributes)) {
        // 既存属性に含まれていなければ追加
        if (!existingAttributes.find((a) => a.name === attrName)) {
          defaultAttributeString += ` ${attrName}="${escapeText(attrValue)}"`;
        }
      }
    }

    return defaultAttributeString;
  }
}

/**
 * HTMLをパースしてサニタイズする関数（後方互換性のため）
 * @param htmlText 入力HTML文字列
 * @param options サニタイズオプション
 * @returns サニタイズ済みHTML文字列
 */
export function sanitizeHtml(
  htmlText: string,
  options?: SanitizeOptions
): string {
  const parser = new SanitizeParser(options);
  return parser.sanitize(htmlText).html;
}

/**
 * デフォルトエクスポート
 */
export default SanitizeParser;
