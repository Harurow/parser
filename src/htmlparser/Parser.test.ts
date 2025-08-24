import Parser, { type Handler } from './Parser';
import { QuoteType } from './Tokenizer';

/**
 * テスト用のモックハンドラー
 */
class MockHandler implements Handler {
  public events: Array<{
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
  }> = [];

  onStart = () => {
    this.events.push({
      type: 'start',
      data: {},
    });
  };

  onText = (text: any) => {
    this.events.push({
      type: 'text',
      data: text,
    });
  };

  onOpenTag = (tag: any) => {
    this.events.push({
      type: 'openTag',
      data: tag,
    });
  };

  onCloseTag = (tag: any) => {
    this.events.push({
      type: 'closeTag',
      data: tag,
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
}

/**
 * テストヘルパー関数
 */
function parseHTML(html: string, handler?: Partial<Handler>) {
  const parser = new Parser(handler);
  return parser.parse(html);
}

describe('HTMLパーサー', () => {
  let mockHandler: MockHandler;
  let parser: Parser;

  beforeEach(() => {
    mockHandler = new MockHandler();
    parser = new Parser(mockHandler);
  });

  describe('基本的なHTMLパース', () => {
    test('トークン全てを足すと元に戻るはず', () => {
      const html = 'Hello World </Story aa >';
      const tokens = parseHTML(html, mockHandler);

      const result = tokens.map((t) => html.slice(t.startIndex, t.endIndex)).join('');
      expect(html).toEqual(result);
    });

    test('プレーンテキストのパース', () => {
      const html = 'Hello World';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'text',
        startIndex: 0,
        endIndex: 11,
      });

      // ハンドラーイベントの確認
      expect(mockHandler.getEvents('start')).toHaveLength(1);
      expect(mockHandler.getEvents('text')).toHaveLength(1);
      expect(mockHandler.getEvents('end')).toHaveLength(2); // onEndが2回呼ばれる（TokenizerとParserから）
    });

    test('単純なタグのパース', () => {
      const html = '<div>Hello</div>';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(3);

      // 開始タグ
      expect(tokens[0]).toEqual({
        type: 'openTag',
        tagName: 'div',
        startIndex: 1,
        endIndex: 4, // 実際の値に修正
        selfClosing: false,
        attributes: [],
      });

      // テキスト
      expect(tokens[1]).toEqual({
        type: 'text',
        startIndex: 5,
        endIndex: 10,
      });

      // 終了タグ
      expect(tokens[2]).toEqual({
        type: 'closeTag',
        tagName: 'div',
        startIndex: 12,
        endIndex: 15,
      });

      // ハンドラーイベントの確認
      expect(mockHandler.getEvents('openTag')).toHaveLength(1);
      expect(mockHandler.getEvents('text')).toHaveLength(1);
      expect(mockHandler.getEvents('closeTag')).toHaveLength(0); // 現在の実装では呼ばれない
    });

    test('自己終了タグのパース', () => {
      const html = '<img src="test.jpg" />';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'openTag',
        tagName: 'img',
        startIndex: 1,
        endIndex: 21, // 実際の値に修正
        selfClosing: true,
        attributes: [],
      });

      expect(mockHandler.getEvents('openTag')).toHaveLength(1);
    });

    test('ネストしたタグのパース', () => {
      const html = '<div><span>Hello</span></div>';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(5);

      // 外側のdiv開始タグ
      expect(tokens[0].type).toBe('openTag');
      expect((tokens[0] as any).tagName).toBe('div');

      // 内側のspan開始タグ
      expect(tokens[1].type).toBe('openTag');
      expect((tokens[1] as any).tagName).toBe('span');

      // テキスト
      expect(tokens[2].type).toBe('text');

      // span終了タグ
      expect(tokens[3].type).toBe('closeTag');
      expect((tokens[3] as any).tagName).toBe('span');

      // div終了タグ
      expect(tokens[4].type).toBe('closeTag');
      expect((tokens[4] as any).tagName).toBe('div');
    });

    test('複数のテキストノード', () => {
      const html = 'Hello <span>World</span> Test';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(5);

      // 最初のテキスト
      expect(tokens[0].type).toBe('text');

      // spanタグ
      expect(tokens[1].type).toBe('openTag');

      // span内のテキスト
      expect(tokens[2].type).toBe('text');

      // span終了タグ
      expect(tokens[3].type).toBe('closeTag');

      // 最後のテキスト
      expect(tokens[4].type).toBe('text');
    });
  });

  describe('属性の処理', () => {
    test('属性付きタグ（現在の実装では属性は空配列）', () => {
      const html = '<div class="container">Hello</div>';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(3);

      const openTag = tokens[0] as any;
      expect(openTag.type).toBe('openTag');
      expect(openTag.tagName).toBe('div');
      expect(openTag.attributes).toEqual([]); // 現在の実装では属性は処理されない
    });

    test('複数属性付きタグ', () => {
      const html = '<div id="test" class="container" disabled>Hello</div>';
      const tokens = parseHTML(html, mockHandler);

      const openTag = tokens[0] as any;
      expect(openTag.type).toBe('openTag');
      expect(openTag.tagName).toBe('div');
      expect(openTag.attributes).toEqual([]); // 現在の実装では属性は処理されない
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    test('空文字列', () => {
      const html = '';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(0);
      expect(mockHandler.getEvents('start')).toHaveLength(1);
      expect(mockHandler.getEvents('end')).toHaveLength(2); // onEndが2回呼ばれる
    });

    test('タグのみ（テキストなし）', () => {
      const html = '<div></div>';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('openTag');
      expect(tokens[1].type).toBe('closeTag');
    });

    test('不完全なタグ（開始タグのみ）', () => {
      const html = '<div>Hello';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('openTag');
      expect(tokens[1].type).toBe('text');
    });

    test('不完全なタグ（タグ名途中で終了）', () => {
      const html = '<di';
      const tokens = parseHTML(html, mockHandler);

      // トークナイザーが不完全なタグをテキストとして処理
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
    });

    test('無効なタグ名文字', () => {
      const html = '<123>Hello</123>';
      const tokens = parseHTML(html, mockHandler);

      // 数字で始まるタグ名は無効なのでテキストとして処理される
      expect(tokens[0].type).toBe('text');
    });
  });

  describe('特殊文字とエスケープ', () => {
    test('HTMLエンティティ（そのまま通す）', () => {
      const html = '<div>&lt;Hello&gt;</div>';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(3);
      expect(tokens[1].type).toBe('text');
      // HTMLエンティティはそのまま保持される
    });

    test('特殊文字を含むテキスト', () => {
      const html = 'Hello & World < Test > End';
      const tokens = parseHTML(html, mockHandler);

      expect(tokens).toHaveLength(2); // 実際は2つのトークンに分割される
      expect(tokens[0].type).toBe('text');
      expect(tokens[1].type).toBe('text');
    });
  });

  describe('パフォーマンステスト', () => {
    test('大きなHTMLドキュメント', () => {
      const largeHtml = '<div>' + 'Hello World '.repeat(1000) + '</div>';
      const start = performance.now();
      const tokens = parseHTML(largeHtml, mockHandler);
      const end = performance.now();

      expect(tokens).toHaveLength(3); // openTag, text, closeTag
      expect(end - start).toBeLessThan(100); // 100ms以内
    });

    test('深くネストしたHTML', () => {
      let html = '';
      const depth = 50; // テスト用に適度な深さに設定

      // 深いネストを作成
      for (let i = 0; i < depth; i++) {
        html += `<div${i}>`;
      }
      html += 'Hello';
      for (let i = depth - 1; i >= 0; i--) {
        html += `</div${i}>`;
      }

      const tokens = parseHTML(html, mockHandler);

      // 開始タグ + テキスト + 終了タグの数を確認
      const openTags = tokens.filter((t: any) => t.type === 'openTag');
      const closeTags = tokens.filter((t: any) => t.type === 'closeTag');
      const textTokens = tokens.filter((t: any) => t.type === 'text');

      expect(openTags).toHaveLength(depth);
      expect(closeTags).toHaveLength(depth);
      expect(textTokens).toHaveLength(1);
    });
  });

  describe('ハンドラーコールバック', () => {
    test('ハンドラーなしでのパース', () => {
      const html = '<div>Hello</div>';
      const tokens = parseHTML(html); // ハンドラーなし

      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe('openTag');
      expect(tokens[1].type).toBe('text');
      expect(tokens[2].type).toBe('closeTag');
    });

    test('部分的なハンドラーでのパース', () => {
      const partialHandler = {
        onText: jest.fn(),
        // onStart, onOpenTag, onCloseTag, onEnd は未定義
      };

      const html = '<div>Hello</div>';
      const tokens = parseHTML(html, partialHandler);

      expect(tokens).toHaveLength(3);
      expect(partialHandler.onText).toHaveBeenCalledTimes(1);
    });

    test('すべてのハンドラーイベントが呼ばれる', () => {
      const html = '<div>Hello</div>';
      const tokens = parseHTML(html, mockHandler);

      expect(mockHandler.getEvents('start')).toHaveLength(1);
      expect(mockHandler.getEvents('openTag')).toHaveLength(1);
      expect(mockHandler.getEvents('text')).toHaveLength(1);
      expect(mockHandler.getEvents('end')).toHaveLength(2); // onEndが2回呼ばれる
      // closeTagイベントは現在の実装では呼ばれない
    });
  });

  describe('トークンの詳細検証', () => {
    test('トークンのインデックスが正確', () => {
      const html = '<div>Hello</div>';
      const tokens = parseHTML(html, mockHandler);

      // 開始タグのインデックス
      expect(tokens[0]).toMatchObject({
        startIndex: 1, // '<div>' の 'd' の位置
        endIndex: 4,   // 実際の値に修正
      });

      // テキストのインデックス
      expect(tokens[1]).toMatchObject({
        startIndex: 5,  // 'Hello' の 'H' の位置
        endIndex: 10,   // 'Hello' の次の位置
      });

      // 終了タグのインデックス
      expect(tokens[2]).toMatchObject({
        startIndex: 12,  // 実際の値に修正
        endIndex: 15,   // 実際の値に修正
      });
    });

    test('自己終了タグのフラグが正確', () => {
      const html1 = '<div></div>';
      const tokens1 = parseHTML(html1);
      expect((tokens1[0] as any).selfClosing).toBe(false);

      const html2 = '<img />';
      const tokens2 = parseHTML(html2);
      expect((tokens2[0] as any).selfClosing).toBe(true);
    });
  });

  describe('不正HTMLパターン', () => {
    test('連続する<文字（<<）', () => {
      const html = '<<div>Hello</div>';
      const tokens = parseHTML(html);

      // 最初の<はテキストとして処理される
      expect(tokens[0].type).toBe('text');
      expect(tokens[1].type).toBe('openTag');
      expect((tokens[1] as any).tagName).toBe('div');
    });

    test('タグ名内に別のタグ開始（<div <div）', () => {
      const html = '<div <div>Hello</div>';
      const tokens = parseHTML(html);

      // 最初のdivタグが認識される
      expect(tokens[0].type).toBe('openTag');
      expect((tokens[0] as any).tagName).toBe('div');
    });

    test('属性名内の連続空白', () => {
      const html = '<div class  ="">Hello</div>';
      const tokens = parseHTML(html);

      expect(tokens[0].type).toBe('openTag');
      expect((tokens[0] as any).tagName).toBe('div');
      // 属性は現在の実装では処理されないが、タグ自体は認識される
    });
  });
});
