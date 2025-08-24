/**
 * SanitizeParser - htmlparser2のParserを利用したHTMLパーサー
 *
 * 特徴:
 * - htmlparser2のParserを使用
 * - シンプルなHTML処理
 */

import { Parser } from 'htmlparser2';

/** パーサー設定のオプション */
export interface SanitizeOptions {
  // 将来の拡張用
}

/** 自己終了タグのリスト */
const VOID_ELEMENTS = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
];

/** パース結果 */
export interface SanitizeResult {
  /** HTML文字列 */
  html: string;
}

/**
 * HTMLパーサークラス
 */
export class SanitizeParser {
  private result: string[];
  private tagStack: string[];

  constructor(options: SanitizeOptions = {}) {
    this.result = [];
    this.tagStack = [];
  }

  /**
   * HTMLをパースする
   */
  public sanitize(htmlText: string): SanitizeResult {
    this.reset();

    const parser = new Parser({
      onopentag: (name: string, attributes: Record<string, string>) => {
        this.onOpenTag(name, attributes);
      },
      ontext: (text: string) => {
        this.onText(text);
      },
      onclosetag: (tagname: string) => {
        this.onCloseTag(tagname);
      },
      onend: () => {
        this.onEnd();
      }
    });

    parser.write(htmlText);
    parser.end();

    return {
      html: this.result.join('')
    };
  }

  /**
   * 内部状態をリセット
   */
  private reset(): void {
    this.result = [];
    this.tagStack = [];
  }

  /**
   * テキストノードの処理
   */
  private onText(text: string): void {
    this.result.push(text);
  }

  /**
   * 開始タグの処理
   */
  private onOpenTag(name: string, attributes: Record<string, string>): void {
    const tagName = name.toLowerCase();
    const attributeString = this.buildAttributeString(attributes);

    if (this.isVoidElement(tagName)) {
      // void要素は自己終了タグとして出力
      this.result.push(`<${tagName}${attributeString}>`);
    } else {
      // 通常の要素はタグスタックに追加
      this.result.push(`<${tagName}${attributeString}>`);
      this.tagStack.push(tagName);
    }
  }

  /**
   * 終了タグの処理
   */
  private onCloseTag(tagName: string): void {
    const lowerTagName = tagName.toLowerCase();

    // void要素の終了タグは無視
    if (this.isVoidElement(lowerTagName)) {
      return;
    }

    // タグスタックから対応する開始タグを探す
    const stackIndex = this.tagStack.lastIndexOf(lowerTagName);
    if (stackIndex !== -1) {
      // 対応する開始タグが見つかった場合、それより後のタグを閉じる
      for (let i = this.tagStack.length - 1; i >= stackIndex; i--) {
        this.result.push(`</${this.tagStack[i]}>`);
      }
      this.tagStack.splice(stackIndex);
    }
  }

  /**
   * パース終了の処理
   */
  private onEnd(): void {
    // 未閉じのタグを閉じる
    for (let i = this.tagStack.length - 1; i >= 0; i--) {
      this.result.push(`</${this.tagStack[i]}>`);
    }
  }

  /**
   * void要素（自己終了タグ）かどうかをチェック
   */
  private isVoidElement(tagName: string): boolean {
    return VOID_ELEMENTS.includes(tagName);
  }

  /**
   * 属性文字列を構築
   */
  private buildAttributeString(attributes: Record<string, string>): string {
    const attrs = Object.entries(attributes)
      .map(([name, value]) => {
        if (value === '') {
          return name; // 値なし属性
        }
        return `${name}="${value}"`;
      });

    return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  }
}

// デフォルトエクスポート
export default SanitizeParser;
