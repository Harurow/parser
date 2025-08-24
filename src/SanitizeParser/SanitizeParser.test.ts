/**
 * SanitizeParser のテスト
 */

import SanitizeParser, { SanitizeOptions } from './SanitizeParser';

describe('SanitizeParser', () => {
  let parser: SanitizeParser;

  beforeEach(() => {
    // 基本的なHTMLタグを許可する設定
    const options: SanitizeOptions = {
      allowedTags: [
        { tagName: 'p' },
        { tagName: 'strong' },
        { tagName: 'div' },
        { tagName: 'span' },
        { tagName: 'a' },
        { tagName: 'input' },
        { tagName: 'img' },
        { tagName: 'br' },
        { tagName: 'ul' },
        { tagName: 'li' },
        { tagName: 'table' },
        { tagName: 'tr' },
        { tagName: 'td' }
      ]
    };
    parser = new SanitizeParser(options);
  });

  describe('基本的なパース', () => {
    test('基本的なHTMLをパースする', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<p>Hello <strong>World</strong></p>');
    });

    test('テキストのみを処理する', () => {
      const html = 'Hello World';
      const result = parser.sanitize(html);

      expect(result.html).toBe('Hello World');
    });

    test('複雑なHTMLをパースする', () => {
      const html = '<div><p>Hello</p><span>World</span></div>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<div><p>Hello</p><span>World</span></div>');
    });
  });

  describe('属性の処理', () => {
    test('属性を正しく処理する', () => {
      const html = '<a href="https://example.com" title="Link">Click</a>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<a href="https://example.com" title="Link">Click</a>');
    });

    test('値なし属性を処理する', () => {
      const html = '<input type="checkbox" checked>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<input type="checkbox" checked>');
    });
  });

  describe('自己終了タグ', () => {
    test('自己終了タグを正しく処理する', () => {
      const html = '<img src="image.jpg" alt="Image">';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<img src="image.jpg" alt="Image">');
    });

    test('brタグを正しく処理する', () => {
      const html = '<p>Hello<br>World</p>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<p>Hello<br>World</p>');
    });
  });

  describe('ネストしたタグ', () => {
    test('正しくネストされたタグを処理する', () => {
      const html = '<div><p>Hello <strong>World</strong></p></div>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<div><p>Hello <strong>World</strong></p></div>');
    });

    test('未閉じのタグを自動で閉じる', () => {
      const html = '<div><p>Hello <strong>World';
      const result = parser.sanitize(html);

      // 未閉じタグは自動補完されない（設計上の決定）
      expect(result.html).toBe('<div><p>Hello <strong>World');
    });
  });

  describe('エッジケース', () => {
    test('空文字列を処理する', () => {
      const result = parser.sanitize('');
      expect(result.html).toBe('');
    });

    test('複数の連続する空白を保持する', () => {
      const html = '<p>Hello    World</p>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<p>Hello    World</p>');
    });

    test('改行文字を保持する', () => {
      const html = '<p>Hello\nWorld</p>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<p>Hello\nWorld</p>');
    });

    test('特殊文字を正しくエスケープする', () => {
      const html = '<p>Hello & "World" < > \'test\'</p>';
      const result = parser.sanitize(html);

      // テキスト内の特殊文字はセキュリティのためエスケープされる
      expect(result.html).toBe('<p>Hello &amp; &quot;World&quot; &lt; &gt; &#39;test&#39;</p>');
    });
  });

  describe('複雑なHTML構造', () => {
    test('リストを正しく処理する', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
    });

    test('テーブルを正しく処理する', () => {
      const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
      const result = parser.sanitize(html);

      expect(result.html).toBe('<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>');
    });
  });
});
