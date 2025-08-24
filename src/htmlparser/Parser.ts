import Tokenizer, { type Callbacks, QuoteType } from "./Tokenizer";

interface TokenText {
  type: "text";
  startIndex: number;
  endIndex: number;
}

interface TokenAttirubteValue {
  type: "attributeValue";
  value: string | null;
  valueQuoteType: QuoteType | null;
  startIndex: number;
  endIndex: number;
}

interface TokenAttribute {
  type: "attribute";
  name: string;
  startIndex: number;
  endIndex: number;
  value: TokenAttirubteValue | null;
}

interface TokenOpenTag {
  type: "openTag";
  tagName: string;
  startIndex: number;
  endIndex: number;
  tagNameStartIndex: number;
  tagNameEndIndex: number;
  selfClosing: boolean;
  attributes: Array<TokenAttribute> | null;
}

interface TokenCloseTag {
  type: "closeTag";
  tagName: string;
  startIndex: number;
  endIndex: number;
  tagNameStartIndex: number;
  tagNameEndIndex: number;
}

interface TokenTag {
  type: "tag";
  tagName: string;
  startIndex: number;
  endIndex: number;
  children: Array<Token>;
}

type Token = TokenTag | TokenText | TokenOpenTag | TokenCloseTag;

export interface Handler {
  onStart(): void;
  onText(text: TokenText): void;
  onOpenTag(tag: TokenOpenTag): void;
  onCloseTag(tag: TokenCloseTag): void;
  onEnd(): void;
}

export default class Parser implements Callbacks {
  private readonly cbs: Partial<Handler> | null = null;
  private tokens: Array<Token> = [];
  private buffer: string = '';
  private openTags: Array<TokenOpenTag> = [];

  constructor(
    cbs?: Partial<Handler> | null,
  ) {
    this.cbs = cbs || {};
  }

  public parse(rawHtmlText: string): Array<Token> {
    this.tokens = [];
    this.buffer = rawHtmlText || '';
    this.openTags = [];

    const tokenizer = new Tokenizer(this);
    this.cbs?.onStart?.();
    tokenizer.parse(rawHtmlText);
    this.cbs?.onEnd?.();
    return this.tokens;
  }

  /** 属性データが見つかった時に呼び出される */
  public onAttribData(start: number, endIndex: number): void {
  }

  /** 属性の終了時に呼び出される */
  public onAttribEnd(quote: QuoteType, endIndex: number): void {
  }

  /** 属性名が見つかった時に呼び出される */
  public onAttribName(start: number, endIndex: number): void {
  }

  /** 終了タグが見つかった時に呼び出される */
  public onCloseTag(start: number, endIndex: number): void {
    const text = this.buffer.slice(start, endIndex);
    console.log(`CloseTag: "${text}"`);
    const token: TokenCloseTag = {
      type: "closeTag",
      tagName: text,
      startIndex: start - 2, // '</' の位置まで拡張
      endIndex: endIndex + 1, // '>' の次の位置まで拡張
      tagNameStartIndex: start,
      tagNameEndIndex: endIndex,
    };
    this.tokens.push(token);
  }

  /** 開始タグ名が見つかった時に呼び出される */
  public onOpenTagName(start: number, endIndex: number): void {
    const text = this.buffer.slice(start, endIndex);
    console.log(`StartTag: "${text}"`);
    const token: TokenOpenTag = {
      type: "openTag",
      tagName: text,
      selfClosing: false,
      startIndex: start,
      endIndex: endIndex,
      tagNameStartIndex: start,
      tagNameEndIndex: endIndex,
      attributes: [],
    };
    this.openTags.push(token);
  }

  /** 開始タグの終了時に呼び出される */
  public onOpenTagEnd(endIndex: number): void {
    const token = this.openTags.pop();
    if (token) {
      token.startIndex--; // '<' の位置まで拡張
      token.endIndex = endIndex + 1; // '>' の次の位置まで拡張
      this.tokens.push(token);
      this.cbs?.onOpenTag?.(token);
      const text = this.buffer.slice(token.startIndex, token.endIndex);
      console.log(`OpenTag: "${text}"`);
    }
  }

  /** 自己終了タグが見つかった時に呼び出される */
  public onSelfClosingTag(endIndex: number): void {
    const token = this.openTags.pop();
    if (token) {
      token.endIndex = endIndex;
      token.selfClosing = true;
      token.startIndex--; // '<' の位置まで拡張
      token.endIndex = endIndex + 2; // '/>' の次の位置まで拡張
      this.tokens.push(token);
      this.cbs?.onOpenTag?.(token);
      const text = this.buffer.slice(token.startIndex, token.endIndex);
      console.log(`SelfClosingTag: "${text}"`);
    }
  }

  /** テキストが見つかった時に呼び出される */
  public onText(start: number, endIndex: number): void {
    const text = this.buffer.slice(start, endIndex);
    const token: TokenText = {
      type: "text",
      startIndex: start,
      endIndex: endIndex,
    };
    this.tokens.push(token);
    this.cbs?.onText?.(token);
    console.log(`Text: "${text}"`);
  }

  /** パース終了時に呼び出される */
  public onEnd(): void {
    console.log('Parsing ended.');
    this.cbs?.onEnd?.();
  };
}
