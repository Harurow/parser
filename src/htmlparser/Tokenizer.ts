/** 文字コードの定数定義 */
const enum CharCodes {
  Tab = 0x9, // "\t"
  NewLine = 0xa, // "\n"
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

/** トークナイザーが取りうるすべての状態 */
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
 * 指定された文字コードが空白文字かどうかを判定する
 * @param c 判定する文字コード
 * @returns 空白文字の場合はtrue
 */
function isWhitespace(c: number): boolean {
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.CarriageReturn
  );
}

/**
 * 指定された文字コードがタグセクションの終端かどうかを判定する
 * @param c 判定する文字コード
 * @returns タグセクションの終端の場合はtrue
 */
function isEndOfTagSection(c: number): boolean {
  return (
    c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c)
  );
}

/**
 * 指定された文字コードがASCIIアルファベットかどうかを判定する
 * @param c 判定する文字コード
 * @returns ASCIIアルファベットの場合はtrue
 */
function isASCIIAlpha(c: number): boolean {
  return (
    (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
    (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)
  );
}

/** 属性値のクォートタイプ */
export enum QuoteType {
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3,
}

/** トークナイザーのコールバック関数群 */
export interface Callbacks {
  /** 属性データが見つかった時に呼び出される */
  onAttribData: (start: number, endIndex: number) => void;
  /** 属性の終了時に呼び出される */
  onAttribEnd: (quote: QuoteType, endIndex: number) => void;
  /** 属性名が見つかった時に呼び出される */
  onAttribName: (start: number, endIndex: number) => void;
  /** 終了タグが見つかった時に呼び出される */
  onCloseTag: (start: number, endIndex: number) => void;
  /** 開始タグの終了時に呼び出される */
  onOpenTagEnd: (endIndex: number) => void;
  /** 開始タグ名が見つかった時に呼び出される */
  onOpenTagName: (start: number, endIndex: number) => void;
  /** 自己終了タグが見つかった時に呼び出される */
  onSelfClosingTag: (endIndex: number) => void;
  /** テキストが見つかった時に呼び出される */
  onText: (start: number, endIndex: number) => void;
  /** パース終了時に呼び出される */
  onEnd: () => void;
}

/** HTMLトークナイザークラス */
export default class Tokenizer {
  /** コールバック関数群のインスタンス */
  private readonly cbs: Callbacks;
  /** トークナイザーの現在の状態 */
  private state = State.Text;
  /** 読み取りバッファ */
  private buffer = '';
  /** 現在読み取り中のセクションの開始位置 */
  private sectionStart = 0;
  /** バッファ内で現在参照しているインデックス */
  private index = 0;

  /**
   * コンストラクタ
   * @param cbs コールバック関数群
   */
  constructor(cbs: Callbacks) {
    this.cbs = cbs;
  }

  /**
   * パースを実行する
   * @param rawHtml 処理するHTML文字列
   */
  public parse(rawHtml: string): void {
    this.state = State.Text;
    this.sectionStart = 0;
    this.index = 0;

    this.buffer = rawHtml;
    this.parseInternal();
    this.finish();
  }

  /**
   * テキスト状態の処理
   * @param c 現在の文字コード
   */
  private stateText(c: number): void {
    if (c === CharCodes.Lt) {
      if (this.index > this.sectionStart) {
        this.cbs.onText(this.sectionStart, this.index);
      }
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
    }
  }

  /**
   * HTMLはタグ名の開始文字としてASCIIアルファベット文字(a-z、A-Z)のみを許可する。
   *
   * XMLではより多くの文字が許可される(@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar)。
   * ここではタグを終了させない文字を許可する。
   * @param c 判定する文字コード
   * @returns タグ開始文字として有効な場合はtrue
   */
  private isTagStartChar(c: number) {
    return isASCIIAlpha(c);
  }

  /**
   * タグ名前状態の処理
   * @param c 現在の文字コード
   */
  private stateBeforeTagName(c: number): void {
    if (this.isTagStartChar(c)) {
      this.sectionStart = this.index;
      this.state = State.InTagName;
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName;
    } else {
      this.state = State.Text;
      this.stateText(c);
    }
  }

  /**
   * タグ名内状態の処理
   * @param c 現在の文字コード
   */
  private stateInTagName(c: number): void {
    if (isEndOfTagSection(c)) {
      this.cbs.onOpenTagName(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  /**
   * 終了タグ名前状態の処理
   * @param c 現在の文字コード
   */
  private stateBeforeClosingTagName(c: number): void {
    if (isWhitespace(c)) {
      // 無視
    } else if (c === CharCodes.Gt) {
      this.state = State.Text;
    } else {
      this.state = State.InClosingTagName;
      this.sectionStart = this.index;
    }
  }

  /**
   * 終了タグ名内状態の処理
   * @param c 現在の文字コード
   */
  private stateInClosingTagName(c: number): void {
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onCloseTag(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }

  /**
   * 終了タグ名後状態の処理
   * @param c 現在の文字コード
   */
  private stateAfterClosingTagName(c: number): void {
    if (c === CharCodes.Gt) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }

  /**
   * 属性名前状態の処理
   * @param c 現在の文字コード
   */
  private stateBeforeAttributeName(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onOpenTagEnd(this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag;
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }

  /**
   * 自己終了タグ内状態の処理
   * @param c 現在の文字コード
   */
  private stateInSelfClosingTag(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onSelfClosingTag(this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  /**
   * 属性名内状態の処理
   * @param c 現在の文字コード
   */
  private stateInAttributeName(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onAttribName(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }

  /**
   * 属性名後状態の処理
   * @param c 現在の文字コード
   */
  private stateAfterAttributeName(c: number): void {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue;
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onAttribEnd(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (!isWhitespace(c)) {
      this.cbs.onAttribEnd(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }

  /**
   * 属性値前状態の処理
   * @param c 現在の文字コード
   */
  private stateBeforeAttributeValue(c: number): void {
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttributeValueDq;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttributeValueSq;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index;
      this.state = State.InAttributeValueNq;
      this.stateInAttributeValueNoQuotes(c); // トークンを再消費
    }
  }

  /**
   * 属性値内の処理を行う
   * @param c 現在の文字コード
   * @param quote クォート文字コード
   */
  private handleInAttributeValue(c: number, quote: number) {
    if (c === quote) {
      this.cbs.onAttribData(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onAttribEnd(
        quote === CharCodes.DoubleQuote
          ? QuoteType.Double
          : QuoteType.Single,
        this.index + 1,
      );
      this.state = State.BeforeAttributeName;
    }
  }

  /**
   * ダブルクォート属性値内状態の処理
   * @param c 現在の文字コード
   */
  private stateInAttributeValueDoubleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote);
  }

  /**
   * シングルクォート属性値内状態の処理
   * @param c 現在の文字コード
   */
  private stateInAttributeValueSingleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.SingleQuote);
  }

  /**
   * クォートなし属性値内状態の処理
   * @param c 現在の文字コード
   */
  private stateInAttributeValueNoQuotes(c: number): void {
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onAttribData(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onAttribEnd(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  /**
   * バッファから既に消費されたデータを削除する
   */
  private cleanup() {
    // テキストまたは属性の内部にいる場合、既に持っているものを出力する。
    if (this.sectionStart !== this.index) {
      if (this.state === State.Text) {
        this.cbs.onText(this.sectionStart, this.index);
        this.sectionStart = this.index;
      } else if (
        this.state === State.InAttributeValueDq ||
        this.state === State.InAttributeValueSq ||
        this.state === State.InAttributeValueNq
      ) {
        this.cbs.onAttribData(this.sectionStart, this.index);
        this.sectionStart = this.index;
      }
    }
  }

  /**
   * 処理を継続すべきかどうかを判定する
   * @returns 継続すべき場合はtrue
   */
  private shouldContinue() {
    return this.index < this.buffer.length;
  }

  /**
   * バッファを反復処理し、現在の状態に対応する関数を呼び出す。
   *
   * パフォーマンス向上のため、よりヒットしやすい状態を上に配置している。
   */
  private parseInternal() {
    while (this.shouldContinue()) {
      const c = this.buffer.charCodeAt(this.index);
      switch (this.state) {
        case State.Text: {
          this.stateText(c);
          break;
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c);
          break;
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c);
          break;
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c);
          break;
        }
        case State.InTagName: {
          this.stateInTagName(c);
          break;
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c);
          break;
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c);
          break;
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c);
          break;
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c);
          break;
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c);
          break;
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c);
          break;
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c);
          break;
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c);
          break;
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c);
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
  }

  /**
   * パース処理を終了する
   */
  private finish() {
    this.handleTrailingData();

    this.cbs.onEnd();
  }

  /**
   * 末尾のデータを処理する
   * 不完全なタグも含めて、残りのデータを無条件にテキストとして出力する
   */
  private handleTrailingData() {
    const endIndex = this.buffer.length;

    // 残りのデータがない場合、処理終了。
    if (this.sectionStart >= endIndex) {
      return;
    }

    // 不完全なタグや属性も含めて、すべての残りデータをテキストとして出力
    // これにより、データの損失を防ぎ、より堅牢な処理を実現する
    this.cbs.onText(this.sectionStart, endIndex);
  }
}
