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
});
