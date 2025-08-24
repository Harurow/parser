import { SimpleParser } from './SimpleParser';

describe('SimpleParser', () => {
  describe('基本的なHTMLパース', () => {
    test('プレーンテキストのパース', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`),
        onend: () => results.push('end')
      });

      parser.parse('Hello World');

      expect(results).toEqual(['text:Hello World', 'end']);
    });

    test('単純なタグのパース', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push(`open:${name}:${JSON.stringify(attrs)}`),
        ontext: (text) => results.push(`text:${text}`),
        onclosetag: (name) => results.push(`close:${name}`),
        onend: () => results.push('end')
      });

      parser.parse('<div>Hello</div>');

      expect(results).toEqual([
        'open:div:{}',
        'text:Hello',
        'close:div',
        'end'
      ]);
    });

    test('ネストしたタグのパース', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push(`open:${name}`),
        ontext: (text) => results.push(`text:${text}`),
        onclosetag: (name) => results.push(`close:${name}`),
        onend: () => results.push('end')
      });

      parser.parse('<div><span>Hello</span></div>');

      expect(results).toEqual([
        'open:div',
        'open:span',
        'text:Hello',
        'close:span',
        'close:div',
        'end'
      ]);
    });

    test('複数のテキストノード', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        onopentag: (name) => results.push(`open:${name}`),
        ontext: (text) => results.push(`text:${text}`),
        onclosetag: (name) => results.push(`close:${name}`),
        onend: () => results.push('end')
      });

      parser.parse('Before<div>Middle</div>After');

      expect(results).toEqual([
        'text:Before',
        'open:div',
        'text:Middle',
        'close:div',
        'text:After',
        'end'
      ]);
    });
  });

  describe('属性の処理', () => {
    test('属性付きタグ', () => {
      const results: { name: string; attrs: Record<string, string> }[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push({ name, attrs })
      });

      parser.parse('<div class="test">');

      expect(results).toEqual([
        { name: 'div', attrs: { class: 'test' } }
      ]);
    });

    test('複数属性付きタグ', () => {
      const results: { name: string; attrs: Record<string, string> }[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push({ name, attrs })
      });

      parser.parse('<img src="image.jpg" alt="Image" width="100">');

      expect(results).toEqual([
        { name: 'img', attrs: { src: 'image.jpg', alt: 'Image', width: '100' } }
      ]);
    });

    test('値なし属性', () => {
      const results: { name: string; attrs: Record<string, string> }[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push({ name, attrs })
      });

      parser.parse('<input type="checkbox" checked>');

      expect(results).toEqual([
        { name: 'input', attrs: { type: 'checkbox', checked: '' } }
      ]);
    });

    test('シングルクォート属性', () => {
      const results: { name: string; attrs: Record<string, string> }[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push({ name, attrs })
      });

      parser.parse("<div class='test'>");

      expect(results).toEqual([
        { name: 'div', attrs: { class: 'test' } }
      ]);
    });

    test('クォートなし属性', () => {
      const results: { name: string; attrs: Record<string, string> }[] = [];
      const parser = new SimpleParser({
        onopentag: (name, attrs) => results.push({ name, attrs })
      });

      parser.parse('<div class=test>');

      expect(results).toEqual([
        { name: 'div', attrs: { class: 'test' } }
      ]);
    });
  });

  describe('コメントとDOCTYPEの処理', () => {
    test('HTMLコメントは文字列として処理', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`)
      });

      parser.parse('Before<!-- This is a comment -->After');

      expect(results).toEqual([
        'text:Before',
        'text:<!-- This is a comment -->',
        'text:After'
      ]);
    });

    test('DOCTYPEは文字列として処理', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`)
      });

      parser.parse('<!DOCTYPE html>');

      expect(results).toEqual(['text:<!DOCTYPE html>']);
    });
  });

  describe('エラーハンドリング', () => {
    test('空文字列', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`),
        onend: () => results.push('end')
      });

      parser.parse('');

      expect(results).toEqual(['end']);
    });

    test('不完全なタグ（開始タグのみ）', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`),
        onopentag: (name) => results.push(`open:${name}`)
      });

      parser.parse('<div');

      expect(results).toEqual(['text:<div']);
    });

    test('不完全なタグ（タグ名途中で終了）', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`)
      });

      parser.parse('<di');

      expect(results).toEqual(['text:<di']);
    });

    test('無効なタグ名文字', () => {
      const results: string[] = [];
      const parser = new SimpleParser({
        ontext: (text) => results.push(`text:${text}`)
      });

      parser.parse('<123>');

      expect(results).toEqual(['text:<123>']);
    });
  });

  describe('htmlparser2との互換性テスト', () => {
    test('htmlparser2と同じ結果を返す', () => {
      const html = '<div class="test">Hello <span>World</span></div>';

      // SimpleParserの結果
      const simpleResults: string[] = [];
      const simpleParser = new SimpleParser({
        onopentag: (name, attrs) => simpleResults.push(`open:${name}:${JSON.stringify(attrs)}`),
        ontext: (text) => simpleResults.push(`text:${text}`),
        onclosetag: (name) => simpleResults.push(`close:${name}`)
      });

      simpleParser.parse(html);

      expect(simpleResults).toEqual([
        'open:div:{"class":"test"}',
        'text:Hello ',
        'open:span:{}',
        'text:World',
        'close:span',
        'close:div'
      ]);
    });

    test('複雑なHTMLの処理', () => {
      const html = '<div><p>段落1</p><p>段落2</p></div>';
      const results: string[] = [];

      const parser = new SimpleParser({
        onopentag: (name) => results.push(`open:${name}`),
        ontext: (text) => results.push(`text:${text}`),
        onclosetag: (name) => results.push(`close:${name}`)
      });

      parser.parse(html);

      expect(results).toEqual([
        'open:div',
        'open:p',
        'text:段落1',
        'close:p',
        'open:p',
        'text:段落2',
        'close:p',
        'close:div'
      ]);
    });
  });
});
