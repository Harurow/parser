/**
 * SimpleParser - htmlparser2のParserを模倣したシンプルなHTMLパーサー
 *
 * 特徴:
 * - XMLモードなし
 * - タグ、属性の小文字変換なし
 * - タグ名でのモード切り替えなし
 * - シンプルな実装
 * - parse一回で処理完了
 */

export interface SimpleParserOptions {
  // 将来の拡張用
}

export interface SimpleParserCallbacks {
  onopentag?: (name: string, attributes: Record<string, string>) => void;
  ontext?: (text: string) => void;
  onclosetag?: (tagname: string) => void;
  onerror?: (error: Error) => void;
  onend?: () => void;
}

/**
 * シンプルなHTMLパーサークラス
 * htmlparser2のParserのAPIを模倣しつつ、シンプルな実装を提供
 */
export class SimpleParser {
  private callbacks: SimpleParserCallbacks;
  private options: SimpleParserOptions;

  constructor(callbacks: SimpleParserCallbacks = {}, options: SimpleParserOptions = {}) {
    this.callbacks = callbacks;
    this.options = options;
  }

  /**
   * HTMLを一回でパースする
   */
  parse(html: string): void {
    let position = 0;
    const buffer = html;

    while (position < buffer.length) {
      const char = buffer[position];

      if (char === '<') {
        position = this.parseTag(buffer, position);
      } else {
        position = this.parseText(buffer, position);
      }
    }

    this.callbacks.onend?.();
  }

  /**
   * テキストノードをパース
   */
  private parseText(buffer: string, startPosition: number): number {
    const start = startPosition;
    let position = startPosition;

    // 次の '<' まで、またはバッファの終端まで進む
    while (position < buffer.length && buffer[position] !== '<') {
      position++;
    }

    const text = buffer.slice(start, position);
    if (text) {
      this.callbacks.ontext?.(text);
    }

    return position;
  }

  /**
   * タグをパース
   */
  private parseTag(buffer: string, startPosition: number): number {
    let position = startPosition;

    if (position >= buffer.length) return position;

    position++; // '<' をスキップ

    if (position >= buffer.length) {
      // 不完全なタグ - テキストとして処理
      this.callbacks.ontext?.('<');
      return position;
    }

    const nextChar = buffer[position];

    if (nextChar === '/') {
      // 終了タグ
      return this.parseCloseTag(buffer, position);
    } else if (this.isValidTagNameStart(nextChar)) {
      // 開始タグ
      return this.parseOpenTag(buffer, position);
    } else {
      // 無効なタグ（コメント、DOCTYPE等も含む）- テキストとして処理
      // '<' から次の '<' または終端まで全てテキストとして処理
      return this.parseText(buffer, startPosition);
    }
  }

  /**
   * 開始タグをパース
   */
  private parseOpenTag(buffer: string, startPosition: number): number {
    let position = startPosition;
    const tagNameStart = position;

    // タグ名を読み取り
    while (position < buffer.length && this.isValidTagNameChar(buffer[position])) {
      position++;
    }

    if (position === tagNameStart) {
      // タグ名が空
      this.callbacks.ontext?.('<');
      return position;
    }

    const tagName = buffer.slice(tagNameStart, position);
    const attributes: Record<string, string> = {};

    // 属性をパース
    position = this.parseAttributes(buffer, position, attributes);

    // '>' を探す
    if (position < buffer.length && buffer[position] === '>') {
      position++; // '>' をスキップ
      this.callbacks.onopentag?.(tagName, attributes);
    } else {
      // 不完全なタグ - テキストとして処理
      this.callbacks.ontext?.('<');
      return startPosition + 1;
    }

    return position;
  }

  /**
   * 終了タグをパース
   */
  private parseCloseTag(buffer: string, startPosition: number): number {
    let position = startPosition;
    position++; // '/' をスキップ
    const tagNameStart = position;

    // タグ名を読み取り
    while (position < buffer.length && this.isValidTagNameChar(buffer[position])) {
      position++;
    }

    if (position === tagNameStart) {
      // タグ名が空
      this.callbacks.ontext?.('</');
      return position;
    }

    const tagName = buffer.slice(tagNameStart, position);

    // 空白をスキップ
    position = this.skipWhitespace(buffer, position);

    // '>' を探す
    if (position < buffer.length && buffer[position] === '>') {
      position++; // '>' をスキップ
      this.callbacks.onclosetag?.(tagName);
    } else {
      // 不完全なタグ - テキストとして処理
      this.callbacks.ontext?.('<');
      return startPosition + 1;
    }

    return position;
  }

  /**
   * 属性をパース
   */
  private parseAttributes(buffer: string, startPosition: number, attributes: Record<string, string>): number {
    let position = startPosition;

    while (position < buffer.length) {
      position = this.skipWhitespace(buffer, position);

      if (position >= buffer.length) break;

      const char = buffer[position];
      if (char === '>' || char === '/') {
        break;
      }

      // 属性名を読み取り
      const attrNameStart = position;
      while (position < buffer.length && this.isValidAttributeNameChar(buffer[position])) {
        position++;
      }

      if (position === attrNameStart) {
        // 無効な属性名
        break;
      }

      const attrName = buffer.slice(attrNameStart, position);
      position = this.skipWhitespace(buffer, position);

      if (position < buffer.length && buffer[position] === '=') {
        position++; // '=' をスキップ
        position = this.skipWhitespace(buffer, position);

        // 属性値を読み取り
        const result = this.parseAttributeValue(buffer, position);
        attributes[attrName] = result.value;
        position = result.position;
      } else {
        // 値なし属性
        attributes[attrName] = '';
      }
    }

    return position;
  }

  /**
   * 属性値をパース
   */
  private parseAttributeValue(buffer: string, startPosition: number): { value: string; position: number } {
    let position = startPosition;

    if (position >= buffer.length) return { value: '', position };

    const quote = buffer[position];
    if (quote === '"' || quote === "'") {
      // クォートされた値
      position++; // クォートをスキップ
      const start = position;

      while (position < buffer.length && buffer[position] !== quote) {
        position++;
      }

      const value = buffer.slice(start, position);
      if (position < buffer.length) {
        position++; // 終了クォートをスキップ
      }
      return { value, position };
    } else {
      // クォートなし値
      const start = position;
      while (position < buffer.length && !this.isWhitespace(buffer[position]) && buffer[position] !== '>') {
        position++;
      }
      return { value: buffer.slice(start, position), position };
    }
  }

  /**
   * 空白文字をスキップ
   */
  private skipWhitespace(buffer: string, startPosition: number): number {
    let position = startPosition;
    while (position < buffer.length && this.isWhitespace(buffer[position])) {
      position++;
    }
    return position;
  }

  /**
   * 文字が空白かどうかを判定
   */
  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  /**
   * タグ名の開始文字として有効かどうかを判定
   */
  private isValidTagNameStart(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  /**
   * タグ名の文字として有効かどうかを判定
   */
  private isValidTagNameChar(char: string): boolean {
    return /[a-zA-Z0-9\-_:]/.test(char);
  }

  /**
   * 属性名の文字として有効かどうかを判定
   */
  private isValidAttributeNameChar(char: string): boolean {
    return /[a-zA-Z0-9\-_:]/.test(char);
  }
}

// デフォルトエクスポート
export default SimpleParser;
