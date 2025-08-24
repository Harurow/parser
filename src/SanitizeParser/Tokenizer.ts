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

function isWhitespace(c: number): boolean {
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.FormFeed ||
    c === CharCodes.CarriageReturn
  );
}

function isEndOfTagSection(c: number): boolean {
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
}

function isASCIIAlpha(c: number): boolean {
  return (
    (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
    (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)
  );
}

export enum QuoteType {
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3,
}

export interface Callbacks {
  onattribdata(start: number, endIndex: number): void;
  onattribend(quote: QuoteType, endIndex: number): void;
  onattribname(start: number, endIndex: number): void;
  onclosetag(start: number, endIndex: number): void;
  onend(): void;
  onopentagend(endIndex: number): void;
  onopentagname(start: number, endIndex: number): void;
  onselfclosingtag(endIndex: number): void;
  ontext(start: number, endIndex: number): void;
}

export default class Tokenizer {
  /** The current state the tokenizer is in. */
  private state = State.Text;
  /** The read buffer. */
  private buffer = "";
  /** The beginning of the section that is currently being read. */
  private sectionStart = 0;
  /** The index within the buffer that we are currently looking at. */
  private index = 0;

  constructor(private readonly cbs: Callbacks) {}

  public reset(): void {
    this.state = State.Text;
    this.buffer = "";
    this.sectionStart = 0;
    this.index = 0;
  }

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

  private stateText(c: number): void {
    if (c === CharCodes.Lt) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index);
      }
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
    }
  }

  private stateBeforeTagName(c: number): void {
    if (isASCIIAlpha(c)) {
      this.sectionStart = this.index;
      this.state = State.InTagName;
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName;
    } else {
      this.state = State.Text;
      this.stateText(c);
    }
  }

  private stateInTagName(c: number): void {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  private stateBeforeClosingTagName(c: number): void {
    if (isWhitespace(c)) {
      // Ignore
    } else if (c === CharCodes.Gt) {
      this.state = State.Text;
    } else if (isASCIIAlpha(c)) {
      this.state = State.InClosingTagName;
      this.sectionStart = this.index;
    }
  }

  private stateInClosingTagName(c: number): void {
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }

  private stateAfterClosingTagName(c: number): void {
    if (c === CharCodes.Gt) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }

  private stateBeforeAttributeName(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag;
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }

  private stateInSelfClosingTag(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  private stateInAttributeName(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }

  private stateAfterAttributeName(c: number): void {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue;
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }

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
      this.stateInAttributeValueNoQuotes(c); // Reconsume token
    }
  }

  private handleInAttributeValue(c: number, quote: number) {
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

  private stateInAttributeValueDoubleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote);
  }

  private stateInAttributeValueSingleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.SingleQuote);
  }

  private stateInAttributeValueNoQuotes(c: number): void {
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }

  private finish() {
    const endIndex = this.buffer.length;

    // If there is no remaining data, we are done.
    if (this.sectionStart >= endIndex) {
      this.cbs.onend();
      return;
    }

    // Handle any remaining text
    if (this.state === State.Text) {
      this.cbs.ontext(this.sectionStart, endIndex);
    }

    this.cbs.onend();
  }
}
