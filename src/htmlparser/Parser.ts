import Tokenizer, { type Callbacks, QuoteType } from "./Tokenizer.js";

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
  attributes: Array<TokenAttribute> | null;
}

interface TokenCloseTag {
  type: "closeTag";
  tagName: string;
  startIndex: number;
  endIndex: number;
  selfClosing: boolean;
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

class Parser implements Callbacks {
  private readonly cbs: Partial<Handler> | null = null;
  private tokens: Array<Token> = [];
  private buffer: string = '';

  constructor(
    cbs?: Partial<Handler> | null,
  ) {
    this.cbs = cbs || {};
  }

  public parse(rawHtmlText: string): Array<Token> {
    this.tokens = [];
    this.buffer = rawHtmlText || '';

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
  }

  /** 開始タグの終了時に呼び出される */
  public onOpenTagEnd(endIndex: number): void {
  }

  /** 開始タグ名が見つかった時に呼び出される */
  public onOpenTagName(start: number, endIndex: number): void {
  }

  /** 自己終了タグが見つかった時に呼び出される */
  public onSelfClosingTag(endIndex: number): void {
  }

  /** テキストが見つかった時に呼び出される */
  public onText(start: number, endIndex: number): void {
  }
  

  /** パース終了時に呼び出される */
  public onEnd(): void {
  };
}
