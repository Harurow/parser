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

  const testCases = [
    '<div>',
    '<div >',
    '<div  >',
    '</div>',
    '<br/>',

    '< div>',
    '< /div>',
    '</ div>',
    '</div >',
    '<br />',
    '<br/ >',

    '<div>Hello World</div>',
    '<div class="container">Content</div>',
    '<img src="image.jpg" alt="An image" />',
    '<a href="https://example.com">Link</a>',
    '<ul><li>Item 1</li><li>Item 2</li></ul>',
    '<div><span>Nested</span> Content</div>',
    '<input type="text" value="Sample" />',
    '<!-- This is a comment -->',
    '<div class="test" id="main">Content</div>',
    '<br/>',
    '<meta charset="UTF-8" />',
    '<link rel="stylesheet" href="styles.css" />',
    '<script src="script.js"></script>',
    '<div data-info="Some &quot;quoted&quot; text">Content</div>',
    '<div><p>Paragraph 1</p><p>Paragraph 2</p></div>',
    '<section><header>Header</header><footer>Footer</footer></section>',
    '<div><img src="image.jpg" alt="Image" /></div>',
    '<div class="container"><h1>Title</h1><p>Description</p></div>',
  ];

  describe('基本的なHTMLパース', () => {
    test('トークン全てを足すと元に戻るはず', () => {
      testCases.forEach((rawHtmlText) => {
        const tokens = parseHTML(rawHtmlText, mockHandler);

        const result = tokens.map((t) => rawHtmlText.slice(t.startIndex, t.endIndex)).join('');
        expect(result).toEqual(rawHtmlText);
      });
    });
  });
});
