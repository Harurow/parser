import { sanitizeHtml } from './htmlSanitizer';

describe('HTML Sanitizer', () => {
  describe('基本的なタグ処理', () => {
    test('許可されたタグは通す', () => {
      expect(sanitizeHtml('<strong>テキスト</strong>')).toBe('<strong>テキスト</strong>');
      expect(sanitizeHtml('<u>下線</u>')).toBe('<u>下線</u>');
      expect(sanitizeHtml('<ul><li>項目</li></ul>')).toBe('<ul><li>項目</li></ul>');
      expect(sanitizeHtml('<br>')).toBe('<br>');
    });

    test('許可されていないタグはエスケープ', () => {
      expect(sanitizeHtml('<div>テキスト</div>')).toBe('&lt;div&gt;テキスト&lt;/div&gt;');
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
      expect(sanitizeHtml('<STORY>内容</STORY>')).toBe('&lt;STORY&gt;内容&lt;/STORY&gt;');
    });

    test('ネストしたタグの処理', () => {
      expect(sanitizeHtml('<div><strong>テキスト</strong></div>'))
        .toBe('&lt;div&gt;<strong>テキスト</strong>&lt;/div&gt;');
      expect(sanitizeHtml('<span><u>下線</u><strong>太字</strong></span>'))
        .toBe('&lt;span&gt;<u>下線</u><strong>太字</strong>&lt;/span&gt;');
    });
  });

  describe('属性の処理', () => {
    test('aタグのhref属性', () => {
      // 許可されるURL
      expect(sanitizeHtml('<a href="https://example.com">リンク</a>'))
        .toBe('<a href="https://example.com">リンク</a>');
      expect(sanitizeHtml('<a href="http://example.com">リンク</a>'))
        .toBe('<a href="http://example.com">リンク</a>');
      expect(sanitizeHtml('<a href="/path/to/page">リンク</a>'))
        .toBe('<a href="/path/to/page">リンク</a>');
      expect(sanitizeHtml('<a href="../page.html">リンク</a>'))
        .toBe('<a href="../page.html">リンク</a>');
      expect(sanitizeHtml('<a href="#section1">リンク</a>'))
        .toBe('<a href="#section1">リンク</a>');
      expect(sanitizeHtml('<a href="page.html">リンク</a>'))
        .toBe('<a href="page.html">リンク</a>');

      // 危険なプロトコルは削除
      expect(sanitizeHtml('<a href="javascript:alert(\'xss\')">リンク</a>'))
        .toBe('<a>リンク</a>');
      expect(sanitizeHtml('<a href="data:text/html,<script>alert(\'xss\')</script>">リンク</a>'))
        .toBe('&lt;a href=&quot;data:text/html,&lt;script&gt;alert(\'xss\')&lt;/script&gt;&quot;&gt;リンク&lt;/a&gt;');

      // 空のhrefは削除
      expect(sanitizeHtml('<a href="">リンク</a>'))
        .toBe('<a>リンク</a>');
      expect(sanitizeHtml('<a href="   ">リンク</a>'))
        .toBe('<a>リンク</a>');
    });

    test('aタグの不正な属性は削除', () => {
      expect(sanitizeHtml('<a href="https://example.com" onclick="alert(\'xss\')">リンク</a>'))
        .toBe('<a href="https://example.com">リンク</a>');
      expect(sanitizeHtml('<a class="link" id="mylink">リンク</a>'))
        .toBe('<a>リンク</a>');
    });

    test('fontタグの属性', () => {
      // 許可される属性
      expect(sanitizeHtml('<font color="red">赤い文字</font>'))
        .toBe('<font color="red">赤い文字</font>');
      expect(sanitizeHtml('<font size="3">サイズ3</font>'))
        .toBe('<font size="3">サイズ3</font>');
      expect(sanitizeHtml('<font color="#ff0000" size="12px">文字</font>'))
        .toBe('<font color="#ff0000" size="12px">文字</font>');

      // 不正な属性は削除
      expect(sanitizeHtml('<font style="color: red;">文字</font>'))
        .toBe('<font>文字</font>');
      expect(sanitizeHtml('<font color="red" onclick="alert(\'xss\')">文字</font>'))
        .toBe('<font color="red">文字</font>');
    });

    test('その他のタグの属性は削除', () => {
      expect(sanitizeHtml('<strong class="bold">太字</strong>'))
        .toBe('<strong>太字</strong>');
      expect(sanitizeHtml('<u style="color: red;">下線</u>'))
        .toBe('<u>下線</u>');
    });
  });

  describe('不正なHTML処理', () => {
    test('閉じられていないタグ', () => {
      expect(sanitizeHtml('<aaaa')).toBe('<aaaa');
      expect(sanitizeHtml('<div')).toBe('<div');
      expect(sanitizeHtml('<strong>テキスト<')).toBe('<strong>テキスト<');
    });

    test('空のタグ', () => {
      expect(sanitizeHtml('<>')).toBe('&lt;&gt;');
      expect(sanitizeHtml('<   >')).toBe('&lt;   &gt;');
    });

    test('不正なタグ名', () => {
      expect(sanitizeHtml('<123>テキスト</123>')).toBe('&lt;123&gt;テキスト&lt;/123&gt;');
      expect(sanitizeHtml('<-invalid>テキスト</-invalid>')).toBe('&lt;-invalid&gt;テキスト&lt;/-invalid&gt;');
    });

    test('ネストした不正なタグ', () => {
      expect(sanitizeHtml('<<div>>')).toBe('&lt;&lt;div&gt;>');
      expect(sanitizeHtml('<div<span>>')).toBe('&lt;div&lt;span&gt;>');
    });
  });

  describe('自己完結タグ', () => {
    test('brタグの自己完結形式', () => {
      expect(sanitizeHtml('<br />')).toBe('<br />');
      expect(sanitizeHtml('<br/>')).toBe('<br />');
    });

    test('許可されていないタグの自己完結形式', () => {
      expect(sanitizeHtml('<img src="test.jpg" />')).toBe('&lt;img src=&quot;test.jpg&quot; /&gt;');
      expect(sanitizeHtml('<input type="text" />')).toBe('&lt;input type=&quot;text&quot; /&gt;');
    });
  });

  describe('テキストコンテンツ', () => {
    test('通常のテキストはそのまま', () => {
      expect(sanitizeHtml('普通のテキスト')).toBe('普通のテキスト');
      expect(sanitizeHtml('日本語テキスト')).toBe('日本語テキスト');
      expect(sanitizeHtml('123 & 456')).toBe('123 & 456');
    });

    test('HTMLエンティティはそのまま', () => {
      expect(sanitizeHtml('&lt;div&gt;')).toBe('&lt;div&gt;');
      expect(sanitizeHtml('&amp; &quot;')).toBe('&amp; &quot;');
    });
  });

  describe('複合的なテスト', () => {
    test('複雑なHTML構造', () => {
      const input = `
        <div class="container">
          <strong>重要:</strong> 
          <a href="https://example.com" target="_blank">リンク</a>
          <script>alert('xss')</script>
          <ul>
            <li><font color="red">赤い項目</font></li>
            <li><u>下線項目</u></li>
          </ul>
          <STORY>カスタムタグ</STORY>
        </div>
      `;
      
      const expected = `
        &lt;div class=&quot;container&quot;&gt;
          <strong>重要:</strong> 
          <a href="https://example.com">リンク</a>
          &lt;script&gt;alert('xss')&lt;/script&gt;
          <ul>
            <li><font color="red">赤い項目</font></li>
            <li><u>下線項目</u></li>
          </ul>
          &lt;STORY&gt;カスタムタグ&lt;/STORY&gt;
        &lt;/div&gt;
      `;
      
      expect(sanitizeHtml(input)).toBe(expected);
    });

    test('属性の引用符パターン', () => {
      expect(sanitizeHtml('<a href="https://example.com">リンク</a>'))
        .toBe('<a href="https://example.com">リンク</a>');
      expect(sanitizeHtml("<a href='https://example.com'>リンク</a>"))
        .toBe('<a href="https://example.com">リンク</a>');
      expect(sanitizeHtml('<a href=https://example.com>リンク</a>'))
        .toBe('<a href="https://example.com">リンク</a>');
    });
  });

  describe('エラーハンドリング', () => {
    test('非文字列入力は空文字列を返す', () => {
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
      expect(sanitizeHtml(123 as any)).toBe('');
      expect(sanitizeHtml({} as any)).toBe('');
    });

    test('空文字列は空文字列を返す', () => {
      expect(sanitizeHtml('')).toBe('');
    });
  });

  describe('大文字小文字の処理', () => {
    test('タグ名は小文字に正規化', () => {
      expect(sanitizeHtml('<STRONG>テキスト</STRONG>')).toBe('<strong>テキスト</strong>');
      expect(sanitizeHtml('<Strong>テキスト</Strong>')).toBe('<strong>テキスト</strong>');
      expect(sanitizeHtml('<A HREF="https://example.com">リンク</A>'))
        .toBe('<a href="https://example.com">リンク</a>');
    });

    test('属性名は小文字に正規化', () => {
      expect(sanitizeHtml('<a HREF="https://example.com">リンク</a>'))
        .toBe('<a href="https://example.com">リンク</a>');
      expect(sanitizeHtml('<font COLOR="red" SIZE="3">文字</font>'))
        .toBe('<font color="red" size="3">文字</font>');
    });
  });
});
