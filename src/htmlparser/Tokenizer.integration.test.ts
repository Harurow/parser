/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/prefer-optional-chain */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import Tokenizer, { type Callbacks, QuoteType } from './Tokenizer';

/**
 * 統合テスト用のより詳細なコールバック
 */
class DetailedCallbacks implements Callbacks {
  public parsedStructure: any[] = [];
  private currentElement: any = null;
  private readonly elementStack: any[] = [];
  private readonly buffer = '';

  constructor(private readonly html: string) {}

  onAttribData = (start: number, endIndex: number) => {
    if (this.currentElement && this.currentElement.currentAttribute) {
      this.currentElement.currentAttribute.value =
        this.html.substring(start, endIndex);
    }
  };

  onAttribEnd = (quote: QuoteType, endIndex: number) => {
    if (this.currentElement && this.currentElement.currentAttribute) {
      this.currentElement.currentAttribute.quoteType = quote;
      this.currentElement.attributes.push(
        this.currentElement.currentAttribute,
      );
      this.currentElement.currentAttribute = null;
    }
  };

  onAttribName = (start: number, endIndex: number) => {
    if (this.currentElement) {
      this.currentElement.currentAttribute = {
        name: this.html.substring(start, endIndex),
        value: null,
        quoteType: QuoteType.NoValue,
      };
    }
  };

  onCloseTag = (start: number, endIndex: number) => {
    const tagName = this.html.substring(start, endIndex);
    if (this.elementStack.length > 0) {
      const element = this.elementStack.pop();
      if (element && element.tagName === tagName) {
        if (this.elementStack.length === 0) {
          this.parsedStructure.push(element);
        } else {
          this.elementStack[
            this.elementStack.length - 1
          ].children.push(element);
        }
      }
    }
    this.currentElement =
      this.elementStack.length > 0
        ? this.elementStack[this.elementStack.length - 1]
        : null;
  };

  onOpenTagEnd = (endIndex: number) => {
    // 開始タグが完了
  };

  onOpenTagName = (start: number, endIndex: number) => {
    const tagName = this.html.substring(start, endIndex);
    const element = {
      tagName,
      attributes: [],
      children: [],
      textContent: '',
      currentAttribute: null,
      isSelfClosing: false,
    };

    this.elementStack.push(element);
    this.currentElement = element;
  };

  onSelfClosingTag = (endIndex: number) => {
    if (this.currentElement) {
      this.currentElement.isSelfClosing = true;
      const element = this.elementStack.pop();
      if (this.elementStack.length === 0) {
        this.parsedStructure.push(element);
      } else {
        this.elementStack[this.elementStack.length - 1].children.push(
          element,
        );
      }
    }
    this.currentElement =
      this.elementStack.length > 0
        ? this.elementStack[this.elementStack.length - 1]
        : null;
  };

  onText = (start: number, endIndex: number) => {
    const text = this.html.substring(start, endIndex);
    if (this.currentElement) {
      this.currentElement.textContent += text;
    } else {
      // ルートレベルのテキスト
      this.parsedStructure.push({
        type: 'text',
        content: text,
      });
    }
  };

  onEnd = () => {
    // パース完了
  };
}

/**
 * HTMLを詳細な構造に解析する
 */
function parseToStructure(html: string): any[] {
  const callbacks = new DetailedCallbacks(html);
  const tokenizer = new Tokenizer(callbacks);
  tokenizer.parse(html);
  return callbacks.parsedStructure;
}

describe('HTMLトークナイザー統合テスト', () => {
  describe('実際のHTMLドキュメント', () => {
    test('基本的なHTMLページ', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <meta charset="utf-8">
          </head>
          <body>
            <h1>Hello World</h1>
            <p>This is a test.</p>
          </body>
        </html>
      `.trim();

      const structure = parseToStructure(html);

      // DOCTYPE宣言はテキストとして扱われる
      expect(structure[0].content).toContain('<!DOCTYPE html>');

      // html要素の検証
      const htmlElement = structure.find(
        (el) => el.tagName === 'html',
      );
      expect(htmlElement).toBeDefined();
      expect(htmlElement.children).toHaveLength(2); // head, body

      // head要素の検証
      const headElement = htmlElement.children.find(
        (el: any) => el.tagName === 'head',
      );
      expect(headElement.children).toHaveLength(2); // title, meta

      // title要素の検証
      const titleElement = headElement.children.find(
        (el: any) => el.tagName === 'title',
      );
      expect(titleElement.textContent.trim()).toBe('Test Page');

      // meta要素の検証（自己終了タグ）
      const metaElement = headElement.children.find(
        (el: any) => el.tagName === 'meta',
      );
      expect(metaElement.isSelfClosing).toBe(false); // 現在の実装では<meta>は自己終了として認識されない
      expect(metaElement.attributes[0].name).toBe('charset');
      expect(metaElement.attributes[0].value).toBe('utf-8');
    });

    test('フォーム要素', () => {
      const html = `
        <form action="/submit" method="post">
          <label for="name">Name:</label>
          <input type="text" id="name" name="name" required>
          <label for="email">Email:</label>
          <input type="email" id="email" name="email">
          <button type="submit">Submit</button>
        </form>
      `.trim();

      const structure = parseToStructure(html);
      const formElement = structure[0];

      expect(formElement.tagName).toBe('form');
      expect(formElement.attributes).toHaveLength(2);
      expect(formElement.attributes[0].name).toBe('action');
      expect(formElement.attributes[0].value).toBe('/submit');
      expect(formElement.attributes[1].name).toBe('method');
      expect(formElement.attributes[1].value).toBe('post');

      // 子要素の検証
      const inputs = formElement.children.filter(
        (el: any) => el.tagName === 'input',
      );
      expect(inputs).toHaveLength(2);

      const nameInput = inputs.find((el: any) =>
        el.attributes.some(
          (attr: any) =>
            attr.name === 'name' && attr.value === 'name',
        ),
      );
      expect(
        nameInput.attributes.some(
          (attr: any) => attr.name === 'required',
        ),
      ).toBe(true);
    });

    test('テーブル構造', () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td>
              <td>25</td>
            </tr>
            <tr>
              <td>Jane</td>
              <td>30</td>
            </tr>
          </tbody>
        </table>
      `.trim();

      const structure = parseToStructure(html);
      const tableElement = structure[0];

      expect(tableElement.tagName).toBe('table');
      expect(tableElement.children).toHaveLength(2); // thead, tbody

      const theadElement = tableElement.children.find(
        (el: any) => el.tagName === 'thead',
      );
      const tbodyElement = tableElement.children.find(
        (el: any) => el.tagName === 'tbody',
      );

      expect(theadElement.children).toHaveLength(1); // tr
      expect(tbodyElement.children).toHaveLength(2); // 2つのtr

      const headerRow = theadElement.children[0];
      expect(headerRow.children).toHaveLength(2); // 2つのth
      expect(headerRow.children[0].textContent.trim()).toBe('Name');
      expect(headerRow.children[1].textContent.trim()).toBe('Age');
    });
  });

  describe('複雑な属性パターン', () => {
    test('データ属性', () => {
      const html =
        '<div data-id="123" data-name="test" data-active="true">Content</div>';
      const structure = parseToStructure(html);

      const divElement = structure[0];
      expect(divElement.attributes).toHaveLength(3);

      const dataAttributes = divElement.attributes.filter(
        (attr: any) => attr.name.startsWith('data-'),
      );
      expect(dataAttributes).toHaveLength(3);
    });

    test('イベントハンドラー属性', () => {
      const html =
        '<button onclick="alert(\'Hello\')" onmouseover="highlight(this)">Click me</button>';
      const structure = parseToStructure(html);

      const buttonElement = structure[0];
      expect(buttonElement.attributes).toHaveLength(2);

      const onclickAttr = buttonElement.attributes.find(
        (attr: any) => attr.name === 'onclick',
      );
      expect(onclickAttr.value).toBe("alert('Hello')");
    });

    test('CSS クラスとスタイル', () => {
      const html =
        '<div class="container fluid active" style="color: red; font-size: 14px;">Styled content</div>';
      const structure = parseToStructure(html);

      const divElement = structure[0];
      const classAttr = divElement.attributes.find(
        (attr: any) => attr.name === 'class',
      );
      const styleAttr = divElement.attributes.find(
        (attr: any) => attr.name === 'style',
      );

      expect(classAttr.value).toBe('container fluid active');
      expect(styleAttr.value).toBe('color: red; font-size: 14px;');
    });
  });

  describe('エラー耐性テスト', () => {
    test('不正にネストしたタグ', () => {
      const html = '<div><span><p>Content</div></span></p>';
      const structure = parseToStructure(html);

      // トークナイザーは構造的な検証は行わず、タグを順次処理する
      expect(structure).toHaveLength(1);
      expect(structure[0].tagName).toBe('div');
    });

    test('属性値の引用符不一致', () => {
      const html = '<div class="test\'>Content</div>';
      const structure = parseToStructure(html);

      // 不正な引用符でも可能な限りパースを続行
      expect(structure[0].tagName).toBe('div');
    });

    test('コメント（HTMLコメントは現在サポートされていない）', () => {
      const html =
        '<div><!-- This is a comment --><p>Content</p></div>';
      const structure = parseToStructure(html);

      // コメントはテキストとして処理される
      const divElement = structure[0];
      expect(divElement.textContent).toContain(
        '<!-- This is a comment -->',
      );
    });

    test('不完全なHTMLドキュメント', () => {
      const html = `
        <html>
          <head>
            <title>Incomplete
          <body>
            <div class="container
            <p>Some content
      `.trim();

      const structure = parseToStructure(html);

      // 完全な部分は正常にパース
      const htmlElement = structure.find(
        (el) => el.tagName === 'html',
      );
      expect(htmlElement).toBeDefined();

      // 不完全な部分はテキストとして含まれる
      const textNodes = structure.filter((el) => el.type === 'text');
      const allText = textNodes.map((node) => node.content).join('');
      expect(allText).toContain('<title>Incomplete');
      expect(allText).toContain('<div class="container');
      expect(allText).toContain('<p>Some content');
    });
  });

  describe('パフォーマンスと制限', () => {
    test('非常に長い属性値', () => {
      const longValue = 'x'.repeat(10000);
      const html = `<div data-long="${longValue}">Content</div>`;

      const start = performance.now();
      const structure = parseToStructure(html);
      const end = performance.now();

      expect(structure[0].attributes[0].value).toBe(longValue);
      expect(end - start).toBeLessThan(50); // 50ms以内
    });

    test('多数の属性', () => {
      let html = '<div';
      for (let i = 0; i < 100; i++) {
        html += ` attr${i}="value${i}"`;
      }
      html += '>Content</div>';

      const structure = parseToStructure(html);
      expect(structure[0].attributes).toHaveLength(100);
    });

    test('深いネスト構造の解析', () => {
      let html = '';
      const depth = 50;

      for (let i = 0; i < depth; i++) {
        html += `<div class="level-${i}">`;
      }
      html += 'Deep content';
      for (let i = depth - 1; i >= 0; i--) {
        html += '</div>';
      }

      const structure = parseToStructure(html);

      // 最外側の要素から深さを確認
      let currentElement = structure[0];
      let actualDepth = 1;

      while (
        currentElement.children.length > 0 &&
        currentElement.children[0].tagName
      ) {
        currentElement = currentElement.children[0];
        actualDepth++;
      }

      expect(actualDepth).toBe(depth);
    });
  });

  describe('実用的なHTMLパターン', () => {
    test('ナビゲーションメニュー', () => {
      const html = `
        <nav class="navbar">
          <ul class="nav-list">
            <li><a href="/" class="active">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </nav>
      `.trim();

      const structure = parseToStructure(html);
      const navElement = structure[0];

      expect(navElement.tagName).toBe('nav');

      const ulElement = navElement.children.find(
        (el: any) => el.tagName === 'ul',
      );
      expect(
        ulElement.children.filter((el: any) => el.tagName === 'li'),
      ).toHaveLength(3);

      const activeLink = ulElement.children.find((li: any) =>
        li.children.some((a: any) =>
          a.attributes.some(
            (attr: any) =>
              attr.name === 'class' && attr.value === 'active',
          ),
        ),
      );
      expect(activeLink).toBeDefined();
    });

    test('カード形式のレイアウト', () => {
      const html = `
        <div class="card">
          <img src="image.jpg" alt="Card image" class="card-image" />
          <div class="card-content">
            <h3 class="card-title">Card Title</h3>
            <p class="card-description">This is a description of the card content.</p>
            <button class="btn btn-primary">Read More</button>
          </div>
        </div>
      `.trim();

      const structure = parseToStructure(html);
      const cardElement = structure[0];

      expect(cardElement.tagName).toBe('div');
      expect(cardElement.attributes[0].value).toBe('card');

      const imgElement = cardElement.children.find(
        (el: any) => el.tagName === 'img',
      );
      expect(imgElement.isSelfClosing).toBe(true);

      const contentElement = cardElement.children.find((el: any) =>
        el.attributes.some(
          (attr: any) => attr.value === 'card-content',
        ),
      );
      expect(contentElement.children).toHaveLength(3); // h3, p, button
    });
  });
});
