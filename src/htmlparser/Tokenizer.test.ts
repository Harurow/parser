import Tokenizer, { type Callbacks, QuoteType } from './Tokenizer';

/**
 * テスト用のモックコールバック
 */
class MockCallbacks implements Callbacks {
  public events: Array<{
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
  }> = [];

  onAttribData = (start: number, endIndex: number) => {
    this.events.push({
      type: 'attribData',
      data: { start, endIndex },
    });
  };

  onAttribEnd = (quote: QuoteType, endIndex: number) => {
    this.events.push({
      type: 'attribEnd',
      data: { quote, endIndex },
    });
  };

  onAttribName = (start: number, endIndex: number) => {
    this.events.push({
      type: 'attribName',
      data: { start, endIndex },
    });
  };

  onCloseTag = (start: number, endIndex: number) => {
    this.events.push({
      type: 'closeTag',
      data: { start, endIndex },
    });
  };

  onOpenTagEnd = (endIndex: number) => {
    this.events.push({
      type: 'openTagEnd',
      data: { endIndex },
    });
  };

  onOpenTagName = (start: number, endIndex: number) => {
    this.events.push({
      type: 'openTagName',
      data: { start, endIndex },
    });
  };

  onSelfClosingTag = (endIndex: number) => {
    this.events.push({
      type: 'selfClosingTag',
      data: { endIndex },
    });
  };

  onText = (start: number, endIndex: number) => {
    this.events.push({
      type: 'text',
      data: { start, endIndex },
    });
  };

  onEnd = () => {
    this.events.push({
      type: 'end',
      data: {},
    });
  };

  /**
   * イベントをクリアする
   */
  clear() {
    this.events = [];
  }

  /**
   * 特定のタイプのイベントを取得する
   */
  getEvents(type: string) {
    return this.events.filter((event) => event.type === type);
  }

  /**
   * テキスト内容を取得するヘルパー
   */
  getTextContent(html: string): string {
    return this.getEvents('text')
      .map((event) =>
        html.substring(event.data.start, event.data.endIndex),
      )
      .join('');
  }

  /**
   * タグ名を取得するヘルパー
   */
  getTagNames(html: string): string[] {
    return this.getEvents('openTagName').map((event) =>
      html.substring(event.data.start, event.data.endIndex),
    );
  }

  /**
   * 属性名を取得するヘルパー
   */
  getAttributeNames(html: string): string[] {
    return this.getEvents('attribName').map((event) =>
      html.substring(event.data.start, event.data.endIndex),
    );
  }

  /**
   * 属性値を取得するヘルパー
   */
  getAttributeValues(html: string): string[] {
    return this.getEvents('attribData').map((event) =>
      html.substring(event.data.start, event.data.endIndex),
    );
  }
}

/**
 * テストヘルパー関数
 */
function parseHTML(html: string): MockCallbacks {
  const callbacks = new MockCallbacks();
  const tokenizer = new Tokenizer(callbacks);
  tokenizer.parse(html);
  return callbacks;
}

describe('HTMLトークナイザー', () => {
  let callbacks: MockCallbacks;
  let tokenizer: Tokenizer;

  beforeEach(() => {
    callbacks = new MockCallbacks();
    tokenizer = new Tokenizer(callbacks);
  });

  describe('基本的なHTMLパース', () => {
    test('プレーンテキストのパース', () => {
      const html = 'Hello World';
      const result = parseHTML(html);

      expect(result.getTextContent(html)).toBe('Hello World');
      expect(result.getEvents('text')).toHaveLength(1);
      expect(result.getEvents('end')).toHaveLength(1);
    });

    test('単純なタグのパース', () => {
      const html = '<div>Hello</div>';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getTextContent(html)).toBe('Hello');
      expect(result.getEvents('openTagName')).toHaveLength(1);
      expect(result.getEvents('openTagEnd')).toHaveLength(1);
      expect(result.getEvents('closeTag')).toHaveLength(1);
    });

    test('ネストしたタグのパース', () => {
      const html = '<div><span>Hello</span></div>';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div', 'span']);
      expect(result.getTextContent(html)).toBe('Hello');
      expect(result.getEvents('openTagName')).toHaveLength(2);
      expect(result.getEvents('closeTag')).toHaveLength(2);
    });

    test('複数のテキストノード', () => {
      const html = 'Hello <span>World</span> Test';
      const result = parseHTML(html);

      expect(result.getTextContent(html)).toBe('Hello World Test');
      expect(result.getEvents('text')).toHaveLength(3);
    });
  });

  describe('属性の処理', () => {
    test('値なし属性', () => {
      const html = '<input disabled>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['disabled']);
      expect(result.getEvents('attribEnd')[0].data.quote).toBe(
        QuoteType.NoValue,
      );
    });

    test('ダブルクォート属性', () => {
      const html = '<div class="container">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['container']);
      expect(result.getEvents('attribEnd')[0].data.quote).toBe(
        QuoteType.Double,
      );
    });

    test('シングルクォート属性', () => {
      const html = "<div class='container'>Hello</div>";
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['container']);
      expect(result.getEvents('attribEnd')[0].data.quote).toBe(
        QuoteType.Single,
      );
    });

    test('クォートなし属性', () => {
      const html = '<div class=container>Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['container']);
      expect(result.getEvents('attribEnd')[0].data.quote).toBe(
        QuoteType.Unquoted,
      );
    });

    test('複数の属性', () => {
      const html =
        '<div id="test" class="container" disabled>Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual([
        'id',
        'class',
        'disabled',
      ]);
      expect(result.getAttributeValues(html)).toEqual([
        'test',
        'container',
      ]);

      const attribEndEvents = result.getEvents('attribEnd');
      expect(attribEndEvents[0].data.quote).toBe(QuoteType.Double); // id
      expect(attribEndEvents[1].data.quote).toBe(QuoteType.Double); // class
      expect(attribEndEvents[2].data.quote).toBe(QuoteType.NoValue); // disabled
    });

    test('空の属性値', () => {
      const html = '<div class="">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['']);
    });

    test('属性値内のスペース', () => {
      const html = '<div class="container fluid">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeValues(html)).toEqual([
        'container fluid',
      ]);
    });
  });

  describe('自己終了タグ', () => {
    test('基本的な自己終了タグ', () => {
      const html = '<img src="test.jpg" />';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['img']);
      expect(result.getAttributeNames(html)).toEqual(['src']);
      expect(result.getEvents('selfClosingTag')).toHaveLength(1);
      expect(result.getEvents('openTagEnd')).toHaveLength(0);
    });

    test('属性なし自己終了タグ', () => {
      const html = '<br />';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['br']);
      expect(result.getEvents('selfClosingTag')).toHaveLength(1);
    });

    test('スペースなし自己終了タグ', () => {
      const html = '<hr/>';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['hr']);
      expect(result.getEvents('selfClosingTag')).toHaveLength(1);
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    test('空文字列', () => {
      const html = '';
      const result = parseHTML(html);

      expect(result.events).toHaveLength(1); // onEndのみ
      expect(result.getEvents('end')).toHaveLength(1);
    });

    test('タグのみ（テキストなし）', () => {
      const html = '<div></div>';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('text')).toHaveLength(0);
    });

    test('不完全なタグ（開始タグのみ）', () => {
      const html = '<div>Hello';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getTextContent(html)).toBe('Hello');
    });

    test('不完全なタグ（タグ名途中で終了）', () => {
      const html = '<di';
      const result = parseHTML(html);

      // 不完全なタグもテキストとして出力される（<は既に処理済みなのでdiのみ）
      expect(result.getTextContent(html)).toBe('di');
      expect(result.getTagNames(html)).toEqual([]);
    });

    test('不完全なタグ（属性名途中で終了）', () => {
      const html = '<div cla';
      const result = parseHTML(html);

      // 不完全なタグもテキストとして出力される（divタグは認識されるがclaは残る）
      expect(result.getTextContent(html)).toBe('cla');
      expect(result.getTagNames(html)).toEqual(['div']);
    });

    test('不完全な属性', () => {
      const html = '<div class=';
      const result = parseHTML(html);

      // 不完全な属性もテキストとして出力される（=のみ残る）
      expect(result.getTextContent(html)).toBe('=');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getAttributeNames(html)).toEqual(['class']);
    });

    test('閉じられていないクォート', () => {
      const html = '<div class="unclosed>Hello</div>';
      const result = parseHTML(html);

      // トークナイザーは可能な限りパースを続行する
      expect(result.getTagNames(html)).toEqual(['div']);
    });

    test('属性値途中で終了', () => {
      const html = '<div class="partial';
      const result = parseHTML(html);

      // 不完全な属性値もテキストとして出力される（クォート内の文字列のみ）
      expect(result.getTextContent(html)).toBe('');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getAttributeNames(html)).toEqual(['class']);
    });

    test('複数の不完全要素', () => {
      const html = 'Hello <div>World <span>Test';
      const result = parseHTML(html);

      // 完全な部分は正常にパース、不完全な部分はテキストとして出力
      expect(result.getTagNames(html)).toEqual(['div', 'span']);
      expect(result.getTextContent(html)).toBe('Hello World Test');
    });

    test('無効なタグ名文字', () => {
      const html = '<123>Hello</123>';
      const result = parseHTML(html);

      // 数字で始まるタグ名は無効だが、テキストとして処理される
      expect(result.getTextContent(html)).toContain('<123>Hello');
    });

    test('連続する空白文字', () => {
      const html = '<div   class="test"   id="demo"   >Hello</div>';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getAttributeNames(html)).toEqual(['class', 'id']);
    });

    test('改行を含むHTML', () => {
      const html = `<div
        class="test"
        id="demo">
        Hello
        World
      </div>`;
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getAttributeNames(html)).toEqual(['class', 'id']);
      expect(result.getTextContent(html)).toContain('Hello');
      expect(result.getTextContent(html)).toContain('World');
    });
  });

  describe('特殊文字とエスケープ', () => {
    test('HTMLエンティティ（そのまま通す）', () => {
      const html = '<div>&lt;Hello&gt;</div>';
      const result = parseHTML(html);

      expect(result.getTextContent(html)).toBe('&lt;Hello&gt;');
    });

    test('属性値内の特殊文字', () => {
      const html = '<div title="Hello &amp; World">Test</div>';
      const result = parseHTML(html);

      expect(result.getAttributeValues(html)).toEqual([
        'Hello &amp; World',
      ]);
    });
  });

  describe('パフォーマンステスト', () => {
    test('大きなHTMLドキュメント', () => {
      const largeHtml =
        '<div>' + 'Hello World '.repeat(1000) + '</div>';
      const start = performance.now();
      const result = parseHTML(largeHtml);
      const end = performance.now();

      expect(result.getTagNames(largeHtml)).toEqual(['div']);
      expect(end - start).toBeLessThan(100); // 100ms以内
    });

    test('深くネストしたHTML', () => {
      let html = '';
      const depth = 100;

      // 深いネストを作成
      for (let i = 0; i < depth; i++) {
        html += `<div${i}>`;
      }
      html += 'Hello';
      for (let i = depth - 1; i >= 0; i--) {
        html += `</div${i}>`;
      }

      const result = parseHTML(html);
      expect(result.getEvents('openTagName')).toHaveLength(depth);
      expect(result.getEvents('closeTag')).toHaveLength(depth);
    });
  });

  describe('状態管理', () => {
    test('複数回のparse呼び出し', () => {
      // 注意: 現在の実装では各parseが独立している
      tokenizer.parse('<div>');

      callbacks.clear();
      tokenizer.parse('Hello</div>');

      // 2回目のparseは独立してパースされる（</div>は終了タグとして認識される）
      expect(callbacks.getTextContent('Hello</div>')).toBe('Hello');
      expect(callbacks.getEvents('closeTag')).toHaveLength(1);
    });
  });

  describe('カバレッジ完全化テスト', () => {
    test('終了タグ直後の>文字', () => {
      // stateBeforeClosingTagName で c === CharCodes.Gt の場合をテスト (204行目)
      const html = '</>text';
      const result = parseHTML(html);

      expect(result.getTextContent(html)).toBe('</>text');
    });

    test('属性名後の非空白文字', () => {
      // stateAfterAttributeName で !isWhitespace(c) の場合をテスト (261-263行目)
      const html = '<div class id="test">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class', 'id']);
      expect(result.getAttributeValues(html)).toEqual(['test']);
    });

    test('属性値前の非空白文字', () => {
      // stateBeforeAttributeValue で !isWhitespace(c) の場合をテスト (292-295行目)
      const html = '<div class=test>Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['test']);
    });

    test('空のHTMLでのhandleTrailingData', () => {
      // handleTrailingData で this.sectionStart >= endIndex の場合をテスト (432-433行目)
      const html = '';
      const result = parseHTML(html);

      expect(result.getEvents('text')).toHaveLength(0);
      expect(result.getEvents('end')).toHaveLength(1);
    });

    test('不完全なタグでのhandleTrailingData', () => {
      // handleTrailingData の最後の onText 呼び出しをテスト (448-449行目)
      const html = '<div';
      const result = parseHTML(html);

      // 不完全なタグの残りの部分がテキストとして出力される
      expect(result.getTextContent(html)).toBe('div');
      expect(result.getEvents('text')).toHaveLength(1);
    });

    test('自己終了タグ内の非空白文字', () => {
      // stateInSelfClosingTag で !isWhitespace(c) の場合をテスト
      const html = '<img/src="test">Hello</img>';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['img']);
      expect(result.getAttributeNames(html)).toEqual(['src']);
    });

    test('終了タグ名内の空白文字', () => {
      // stateInClosingTagName で isWhitespace(c) の場合をテスト
      const html = '<div>Hello</div >text';
      const result = parseHTML(html);

      expect(result.getTagNames(html)).toEqual(['div']);
      // 修正後：</div >はテキストとして処理されるため、全体が出力される
      expect(result.getTextContent(html)).toBe('Hello</div >text');
    });

    test('属性値前の空白文字処理', () => {
      // stateBeforeAttributeValue で isWhitespace(c) の場合をテスト
      const html = '<div class=  "test">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['test']);
    });

    test('属性名後の空白文字処理', () => {
      // stateAfterAttributeName で isWhitespace(c) の場合をテスト
      const html = '<div class  ="test">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['test']);
    });

    test('属性値内でのクォート終了', () => {
      // handleInAttributeValue でクォートが一致する場合をテスト
      const html = '<div class="test" id=\'demo\'>Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class', 'id']);
      expect(result.getAttributeValues(html)).toEqual(['test', 'demo']);

      const attribEndEvents = result.getEvents('attribEnd');
      expect(attribEndEvents[0].data.quote).toBe(QuoteType.Double);
      expect(attribEndEvents[1].data.quote).toBe(QuoteType.Single);
    });

    test('連続する<文字（<<）', () => {
      // 連続する<文字の処理をテスト
      const html = '<<div>Hello</div>';
      const result = parseHTML(html);

      // 最初の<はテキストとして、2番目の<からタグとして処理される
      expect(result.getTextContent(html)).toBe('<Hello');
      expect(result.getTagNames(html)).toEqual(['div']);
    });

    test('タグ名内に別のタグ開始（<div <div）', () => {
      // タグ名の途中で新しいタグが始まる場合をテスト
      const html = '<div <div>Hello</div>';
      const result = parseHTML(html);

      // 実際の動作：最初のdivタグが認識され、2番目の<divは無視される
      expect(result.getTextContent(html)).toBe('Hello');
      expect(result.getTagNames(html)).toEqual(['div']);
    });

    test('属性名内の連続空白とクォート（<div class  ="">）', () => {
      // 属性名と=の間に複数の空白がある場合をテスト
      const html = '<div class  ="">Hello</div>';
      const result = parseHTML(html);

      expect(result.getAttributeNames(html)).toEqual(['class']);
      expect(result.getAttributeValues(html)).toEqual(['']);
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getTextContent(html)).toBe('Hello');
    });

    test('属性名後に不完全なタグ（<div class <）', () => {
      // 属性名の後に新しいタグが始まる場合をテスト
      const html = '<div class <span>Hello</span>';
      const result = parseHTML(html);

      // 実際の動作：divタグが認識される
      expect(result.getTextContent(html)).toBe('Hello');
      expect(result.getTagNames(html)).toEqual(['div']);
    });

    test('複数の連続する不正パターン', () => {
      // 複数の不正パターンが組み合わさった場合をテスト
      const html = '<<div class  ="" <span class <p>Hello</p>';
      const result = parseHTML(html);

      // 実際の動作：divタグが最初に認識される
      expect(result.getTextContent(html)).toContain('Hello');
      expect(result.getTagNames(html)).toEqual(['div']);
    });

    test('タグ開始文字のみ（<）', () => {
      // 単独の<文字の処理をテスト
      const html = 'Hello < World';
      const result = parseHTML(html);

      expect(result.getTextContent(html)).toBe('Hello < World');
      expect(result.getTagNames(html)).toEqual([]);
    });

    test('不完全なタグ名と属性の組み合わせ', () => {
      // 様々な不完全パターンの組み合わせをテスト
      const html = '<di class="test" <sp id="demo" <p>Content</p>';
      const result = parseHTML(html);

      // 実際の動作：diタグが最初に認識される
      expect(result.getTextContent(html)).toContain('Content');
      expect(result.getTagNames(html)).toEqual(['di']);
    });
  });

  describe('クローズタグの空白文字テスト', () => {
    test('クローズタグのタグ名前に空白（</ div>）', () => {
      // HTMLの仕様では、クローズタグのタグ名前後に空白は許可されない
      const html = '<div>Hello</ div>World</div>';
      const result = parseHTML(html);

      // </ div>はテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</ div>World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('クローズタグのタグ名後に空白（</div >）', () => {
      const html = '<div>Hello</div >World';
      const result = parseHTML(html);

      // </div >はテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</div >World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(0); // クローズタグとして認識されない
    });

    test('クローズタグのタグ名前後に空白（</ div >）', () => {
      const html = '<div>Hello</ div >World</div>';
      const result = parseHTML(html);

      // </ div >はテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</ div >World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('クローズタグのスラッシュ前に空白（< /div>）', () => {
      const html = '<div>Hello< /div>World</div>';
      const result = parseHTML(html);

      // < /div>はテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello< /div>World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('クローズタグのスラッシュ前とタグ名後に空白（< /div >）', () => {
      const html = '<div>Hello< /div >World</div>';
      const result = parseHTML(html);

      // < /div >はテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello< /div >World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('クローズタグのスラッシュ後とタグ名後に空白（</ div >）', () => {
      const html = '<div>Hello</ div >World</div>';
      const result = parseHTML(html);

      // </ div >はテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</ div >World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('複数の不正なクローズタグパターン', () => {
      const html = '<div>Hello</ div>< /span></ p >< /h1 ></div>';
      const result = parseHTML(html);

      // 全ての不正なクローズタグはテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</ div>< /span></ p >< /h1 >');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('正常なクローズタグと不正なクローズタグの混在', () => {
      const html = '<div><span>Hello</span></ invalid>World</div>';
      const result = parseHTML(html);

      // 正常な</span>と</div>は認識され、</ invalid>はテキストとして処理される
      expect(result.getTextContent(html)).toBe('Hello</ invalid>World');
      expect(result.getTagNames(html)).toEqual(['div', 'span']);
      expect(result.getEvents('closeTag')).toHaveLength(2); // </span>と</div>
    });

    test('タブ文字を含むクローズタグ（</\tdiv>）', () => {
      const html = '<div>Hello</\tdiv>World</div>';
      const result = parseHTML(html);

      // タブ文字を含むクローズタグはテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</\tdiv>World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('改行文字を含むクローズタグ（</\ndiv>）', () => {
      const html = '<div>Hello</\ndiv>World</div>';
      const result = parseHTML(html);

      // 改行文字を含むクローズタグはテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</\ndiv>World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });

    test('複数の空白文字を含むクローズタグ（</  div  >）', () => {
      const html = '<div>Hello</  div  >World</div>';
      const result = parseHTML(html);

      // 複数の空白文字を含むクローズタグはテキストとして処理されるべき
      expect(result.getTextContent(html)).toBe('Hello</  div  >World');
      expect(result.getTagNames(html)).toEqual(['div']);
      expect(result.getEvents('closeTag')).toHaveLength(1); // 最後の</div>のみ
    });
  });
});
