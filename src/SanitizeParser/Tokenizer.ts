/**
 * Tokenizer - htmlparser2のTokenizerをベースに改変
 *
 * This file is based on htmlparser2's Tokenizer.ts
 * Copyright (c) 2012 Felix Böhm
 * MIT License: https://github.com/fb55/htmlparser2/blob/master/LICENSE
 */

/**
 * 文字コード定数
 */
const enum CharCodes {
  Tab = 0x9, // "\t"
  NewLine = 0xa, // "\n"
  FormFeed = 0xc, // "\f"
  CarriageReturn = 0xd, // "\r"
  Space = 0x20, // " "
  SingleQuote = 0x27, // "'"
  DoubleQuote = 0x22, // '"'
  Slash = 0x2f, // "/"
  Lt = 0x3c, // "<"
  Eq = 0x3d, // "="
  Gt = 0x3e, // ">"
  UpperA = 0x41, // "A"
  LowerA = 0x61, // "a"
  UpperZ = 0x5a, // "Z"
  LowerZ = 0x7a, // "z"
}

/** All the states the tokenizer can be in. */
/**
 * トークナイザの状態を表す列挙型
 */
const enum State {
  Text = 1,
  BeforeTagName, // After <
  InTagName,
  InSelfClosingTag,
  BeforeClosingTagName,
  InClosingTagName,
  AfterClosingTagName,

  // Attributes
  BeforeAttributeName,
  InAttributeName,
  AfterAttributeName,
  BeforeAttributeValue,
  InAttributeValueDq, // "
  InAttributeValueSq, // '
  InAttributeValueNq,
}

/**
 * 空白文字かどうか判定
 * @param c 文字コード
 * @returns 空白ならtrue
 */
function isWhitespace(c: number): boolean {
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.FormFeed ||
    c === CharCodes.CarriageReturn
  );
}

/**
 * タグセクションの終了文字か判定
 * @param c 文字コード
 * @returns 終了文字ならtrue
 */
function isEndOfTagSection(c: number): boolean {
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
}

/**
 * ASCII英字か判定
 * @param c 文字コード
 * @returns 英字ならtrue
 */
function isASCIIAlpha(c: number): boolean {
  return (
    (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
    (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)
  );
}

/**
 * 属性値のクォート種別
 */
export enum QuoteType {
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3,
}

/**
 * Tokenizerのコールバック群
 */
export interface Callbacks {
  ontext(start: number, end: number): void;
  onopentagname(start: number, end: number): void;
  onopentagend(end: number, tagStart: number, tagEnd: number): void;
  onselfclosingtag(end: number, tagStart: number, tagEnd: number): void;
  onclosetag(start: number, end: number, tagStart: number, tagEnd: number): void;
  onattribname(start: number, end: number): void;
  onattribdata(start: number, end: number): void;
  onattribend(quote: QuoteType, end: number): void;
  onend(): void;
}

/**
 * HTML文字列をトークンに分割するTokenizerクラス
 * htmlparser2のTokenizerをベースに改変
 */
export default class Tokenizer {
  /** 現在の状態 */
  private state = State.Text;
  /** 読み込みバッファ */
  private buffer = "";
  /** 現在読んでいるセクションの開始位置 */
  private sectionStart = 0;
  /** バッファ内の現在位置 */
  private index = 0;
  /** 現在のタグの開始位置（'<'含む） */
  private tagStart = 0;

  /** コールバック群 */
  constructor(private readonly cbs: Callbacks) {}

  /**
   * トークナイザの状態をリセット
   */
  public reset(): void {
    this.state = State.Text;
    this.buffer = "";
    this.sectionStart = 0;
    this.index = 0;
  }

  /**
   * HTML文字列をパースしてトークン化
   * @param chunk HTML文字列
   */
  public parse(chunk: string): void {
    this.buffer = chunk;
    this.index = 0;
    this.sectionStart = 0;
    this.state = State.Text;

    while (this.index < this.buffer.length) {
      const c = this.buffer.charCodeAt(this.index);

      if (this.state === State.Text) {
        this.stateText(c);
      } else if (this.state === State.BeforeTagName) {
        this.stateBeforeTagName(c);
      } else if (this.state === State.InTagName) {
        this.stateInTagName(c);
      } else if (this.state === State.BeforeClosingTagName) {
        this.stateBeforeClosingTagName(c);
      } else if (this.state === State.InClosingTagName) {
        this.stateInClosingTagName(c);
      } else if (this.state === State.AfterClosingTagName) {
        this.stateAfterClosingTagName(c);
      } else if (this.state === State.BeforeAttributeName) {
        this.stateBeforeAttributeName(c);
      } else if (this.state === State.InAttributeName) {
        this.stateInAttributeName(c);
      } else if (this.state === State.AfterAttributeName) {
        this.stateAfterAttributeName(c);
      } else if (this.state === State.BeforeAttributeValue) {
        this.stateBeforeAttributeValue(c);
      } else if (this.state === State.InAttributeValueDq) {
        this.stateInAttributeValueDoubleQuotes(c);
      } else if (this.state === State.InAttributeValueSq) {
        this.stateInAttributeValueSingleQuotes(c);
      } else if (this.state === State.InAttributeValueNq) {
        this.stateInAttributeValueNoQuotes(c);
      } else if (this.state === State.InSelfClosingTag) {
        this.stateInSelfClosingTag(c);
      }

      this.index++;
    }

    this.finish();
  }

  /**
   * テキスト状態の処理
   * @param c 文字コード
   */
  private stateText(c: number): void {
    // 「<」が現れた場合、タグ開始とみなす
    if (c === CharCodes.Lt) {
      // 直前までのテキスト部分をコールバック
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index);
      }
      // タグ名開始状態へ遷移
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
      this.tagStart = this.index; // タグの開始位置を記録
    }
  }

  /**
   * タグ名開始前の処理
   * @param c 文字コード
   */
  private stateBeforeTagName(c: number): void {
    // タグ名の先頭が英字の場合、タグ名状態へ
    if (isASCIIAlpha(c)) {
      this.sectionStart = this.index;
      this.state = State.InTagName;
    }
    // スラッシュの場合、閉じタグ名開始状態へ
    else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName;
    }
    // それ以外はテキスト状態に戻る
    else {
      this.state = State.Text;
      this.stateText(c);
    }
  }

  /**
   * タグ名中の処理
   * @param c 文字コード
   */
  private stateInTagName(c: number): void {
    // タグ名の終了文字（空白・/・>）の場合、タグ名コールバック・属性名開始状態へ
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  /**
   * 閉じタグ名開始前の処理
   * @param c 文字コード
   */
  private stateBeforeClosingTagName(c: number): void {
    // 空白の場合は何もしない（閉じタグ名の前の空白をスキップ）
    if (isWhitespace(c)) {
      // 何もしない
    }
    // '>'の場合はテキスト状態へ（閉じタグ名がない場合）
    else if (c === CharCodes.Gt) {
      this.state = State.Text;
    }
    // 英字の場合は閉じタグ名状態へ
    else if (isASCIIAlpha(c)) {
      this.state = State.InClosingTagName;
      this.sectionStart = this.index;
    }
  }

  /**
   * 閉じタグ名中の処理
   * @param c 文字コード
   */
  private stateInClosingTagName(c: number): void {
    // 閉じタグ名の終了（空白または>）の場合、閉じタグコールバック・閉じタグ名後状態へ
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index, this.tagStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }

  /**
   * 閉じタグ名後の処理
   * @param c 文字コード
   */
  private stateAfterClosingTagName(c: number): void {
    // '>'の場合はテキスト状態へ（閉じタグ終了）
    if (c === CharCodes.Gt) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }

  /**
   * 属性名開始前の処理
   * @param c 文字コード
   */
  private stateBeforeAttributeName(c: number): void {
    // '>'の場合はタグ終了コールバック・テキスト状態へ
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index, this.tagStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
    // '/'の場合は自己終了タグ状態へ
    else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag;
    }
    // 空白以外の場合は属性名状態へ
    else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }

  /**
   * 自己終了タグ中の処理
   * @param c 文字コード
   */
  private stateInSelfClosingTag(c: number): void {
    // '>'の場合は自己終了タグコールバック・テキスト状態へ
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index, this.tagStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
    // 空白以外の場合は属性名開始前状態へ
    else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  /**
   * 属性名中の処理
   * @param c 文字コード
   */
  private stateInAttributeName(c: number): void {
    // '='または属性名の終了文字の場合、属性名コールバック・属性名後状態へ
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }

  /**
   * 属性名後の処理
   * @param c 文字コード
   */
  private stateAfterAttributeName(c: number): void {
    // '='の場合は属性値開始前状態へ
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue;
    }
    // '/'または'>'の場合は属性終了コールバック・属性名開始前状態へ
    else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
    // 空白以外の場合は属性終了コールバック・属性名状態へ
    else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }

  /**
   * 属性値開始前の処理
   * @param c 文字コード
   */
  private stateBeforeAttributeValue(c: number): void {
    // '"'の場合はダブルクォート属性値状態へ
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttributeValueDq;
      this.sectionStart = this.index + 1;
    }
    // '\''の場合はシングルクォート属性値状態へ
    else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttributeValueSq;
      this.sectionStart = this.index + 1;
    }
    // 空白以外の場合はクォートなし属性値状態へ
    else if (!isWhitespace(c)) {
      this.sectionStart = this.index;
      this.state = State.InAttributeValueNq;
      this.stateInAttributeValueNoQuotes(c); // トークンを再消費
    }
  }

  /**
   * 属性値中の処理（クォートあり）
   * @param c 文字コード
   * @param quote クォート文字コード
   */
  private handleInAttributeValue(c: number, quote: number) {
    // クォート文字で属性値が終了した場合、属性値コールバック・属性終了コールバック・属性名開始前状態へ
    if (c === quote) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(
        quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single,
        this.index + 1
      );
      this.state = State.BeforeAttributeName;
    }
  }

  /**
   * 属性値中の処理（ダブルクォート）
   * @param c 文字コード
   */
  private stateInAttributeValueDoubleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote);
  }

  /**
   * 属性値中の処理（シングルクォート）
   * @param c 文字コード
   */
  private stateInAttributeValueSingleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.SingleQuote);
  }

  /**
   * 属性値中の処理（クォートなし）
   * @param c 文字コード
   */
  private stateInAttributeValueNoQuotes(c: number): void {
    // 空白または'>'で属性値が終了した場合、属性値コールバック・属性終了コールバック・属性名開始前状態へ
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  /**
   * パース終了時の処理
   */
  private finish() {
    const endIndex = this.buffer.length;

    // 残りデータがなければ終了コールバック
    if (this.sectionStart >= endIndex) {
      this.cbs.onend();
      return;
    }

    // 残りテキストがあればテキストコールバック
    if (this.state === State.Text) {
      this.cbs.ontext(this.sectionStart, endIndex);
    }

    // 最終的な終了コールバック
    this.cbs.onend();
  }
}
