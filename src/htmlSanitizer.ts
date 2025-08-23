/**
 * HTML Sanitizer Library
 * 
 * 許可されたHTMLタグと属性のみを通し、それ以外はエスケープする
 */

// 許可されたタグの定義
const ALLOWED_TAGS = new Set(['a', 'u', 'strong', 'ul', 'li', 'br', 'font']);

// タグごとの許可された属性
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  'a': new Set(['href']),
  'font': new Set(['color', 'size']),
  'u': new Set([]),
  'strong': new Set([]),
  'ul': new Set([]),
  'li': new Set([]),
  'br': new Set([])
};

/**
 * HTMLエスケープ関数
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * href属性の値を検証する
 */
function isValidHref(href: string): boolean {
  // 空文字列は無効
  if (!href.trim()) return false;
  
  // 危険なプロトコルをチェック
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
  const lowerHref = href.toLowerCase().trim();
  
  for (const protocol of dangerousProtocols) {
    if (lowerHref.startsWith(protocol)) {
      return false;
    }
  }
  
  // フラグメント（#で始まる）は許可
  if (href.startsWith('#')) return true;
  
  // 相対URL（/で始まる、または./、../で始まる）は許可
  if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) return true;
  
  // http/httpsの絶対URLは許可
  if (href.startsWith('http://') || href.startsWith('https://')) return true;
  
  // 相対パス（プロトコルなし）は許可
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return true;
  
  return false;
}

/**
 * font属性の値を基本的にチェックする
 */
function isValidFontAttribute(attrName: string, value: string): boolean {
  if (!value.trim()) return false;
  
  if (attrName === 'color') {
    // 基本的な形式チェック（英数字、#、()、,、スペースを含む）
    return /^[a-zA-Z0-9#(),\s]+$/.test(value);
  }
  
  if (attrName === 'size') {
    // 基本的な形式チェック（数字、単位文字を含む）
    return /^[0-9.]+[a-zA-Z%]*$/.test(value);
  }
  
  return false;
}

/**
 * HTMLタグをパースする簡易パーサー
 */
interface ParsedTag {
  type: 'opening' | 'closing' | 'selfClosing' | 'text' | 'invalid';
  tagName?: string;
  attributes?: Record<string, string>;
  content: string;
  originalText: string;
}

function parseHtmlTokens(html: string): ParsedTag[] {
  const tokens: ParsedTag[] = [];
  let i = 0;
  
  while (i < html.length) {
    if (html[i] === '<') {
      // タグの開始を検出
      const tagStart = i;
      let tagEnd = i + 1;
      
      // タグの終了を探す
      while (tagEnd < html.length && html[tagEnd] !== '>') {
        tagEnd++;
      }
      
      if (tagEnd >= html.length) {
        // 閉じられていないタグ - テキストとして扱う
        const textEnd = html.indexOf('<', i + 1);
        const endPos = textEnd === -1 ? html.length : textEnd;
        tokens.push({
          type: 'text',
          content: html.slice(i, endPos),
          originalText: html.slice(i, endPos)
        });
        i = endPos;
        continue;
      }
      
      const tagContent = html.slice(tagStart + 1, tagEnd);
      const fullTag = html.slice(tagStart, tagEnd + 1);
      
      // 空のタグや不正なタグをチェック
      if (!tagContent.trim()) {
        tokens.push({
          type: 'invalid',
          content: fullTag,
          originalText: fullTag
        });
        i = tagEnd + 1;
        continue;
      }
      
      // タグ内に < > が含まれている場合は不正
      if (/[<>]/.test(tagContent)) {
        tokens.push({
          type: 'invalid',
          content: fullTag,
          originalText: fullTag
        });
        i = tagEnd + 1;
        continue;
      }
      
      // 閉じタグかチェック
      if (tagContent.startsWith('/')) {
        const tagName = tagContent.slice(1).trim().toLowerCase();
        if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(tagName)) {
          tokens.push({
            type: 'closing',
            tagName,
            content: fullTag,
            originalText: fullTag
          });
        } else {
          tokens.push({
            type: 'invalid',
            content: fullTag,
            originalText: fullTag
          });
        }
        i = tagEnd + 1;
        continue;
      }
      
      // 自己完結タグかチェック
      const isSelfClosing = tagContent.endsWith('/');
      const actualTagContent = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent;
      
      // タグ名と属性を分離
      const spaceIndex = actualTagContent.search(/\s/);
      const tagName = (spaceIndex === -1 ? actualTagContent : actualTagContent.slice(0, spaceIndex)).toLowerCase();
      const attributesString = spaceIndex === -1 ? '' : actualTagContent.slice(spaceIndex + 1);
      
      // タグ名の検証
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(tagName)) {
        tokens.push({
          type: 'invalid',
          content: fullTag,
          originalText: fullTag
        });
        i = tagEnd + 1;
        continue;
      }
      
      // 属性をパース
      const attributes: Record<string, string> = {};
      if (attributesString.trim()) {
        const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
        let match;
        while ((match = attrRegex.exec(attributesString)) !== null) {
          const attrName = match[1].toLowerCase();
          const attrValue = match[2] || match[3] || match[4] || '';
          attributes[attrName] = attrValue;
        }
      }
      
      tokens.push({
        type: isSelfClosing ? 'selfClosing' : 'opening',
        tagName,
        attributes,
        content: fullTag,
        originalText: fullTag
      });
      
      i = tagEnd + 1;
    } else {
      // テキストコンテンツ
      const textStart = i;
      let textEnd = html.indexOf('<', i);
      if (textEnd === -1) textEnd = html.length;
      
      const textContent = html.slice(textStart, textEnd);
      if (textContent) {
        tokens.push({
          type: 'text',
          content: textContent,
          originalText: textContent
        });
      }
      
      i = textEnd;
    }
  }
  
  return tokens;
}

/**
 * HTMLサニタイザーのメイン関数
 */
export function sanitizeHtml(html: string): string {
  try {
    if (typeof html !== 'string') {
      return '';
    }
    
    const tokens = parseHtmlTokens(html);
    const result: string[] = [];
    
    for (const token of tokens) {
      if (token.type === 'text') {
        // テキストはそのまま出力（HTMLエスケープはしない、元のテキストを保持）
        result.push(token.content);
      } else if (token.type === 'invalid') {
        // 不正なタグはエスケープ
        result.push(escapeHtml(token.content));
      } else if (token.type === 'opening' || token.type === 'selfClosing') {
        const { tagName, attributes } = token;
        
        if (!tagName || !ALLOWED_TAGS.has(tagName)) {
          // 許可されていないタグはエスケープ
          result.push(escapeHtml(token.content));
        } else {
          // 許可されたタグの処理
          const allowedAttrs = ALLOWED_ATTRIBUTES[tagName];
          const validAttributes: string[] = [];
          
          if (attributes) {
            for (const [attrName, attrValue] of Object.entries(attributes)) {
              if (allowedAttrs.has(attrName)) {
                let isValid = true;
                
                // 属性値の検証
                if (tagName === 'a' && attrName === 'href') {
                  isValid = isValidHref(attrValue);
                } else if (tagName === 'font' && (attrName === 'color' || attrName === 'size')) {
                  isValid = isValidFontAttribute(attrName, attrValue);
                }
                
                if (isValid) {
                  validAttributes.push(`${attrName}="${attrValue}"`);
                }
              }
            }
          }
          
          // タグを再構築
          const attrString = validAttributes.length > 0 ? ' ' + validAttributes.join(' ') : '';
          if (token.type === 'selfClosing') {
            result.push(`<${tagName}${attrString} />`);
          } else {
            result.push(`<${tagName}${attrString}>`);
          }
        }
      } else if (token.type === 'closing') {
        const { tagName } = token;
        
        if (!tagName || !ALLOWED_TAGS.has(tagName)) {
          // 許可されていないタグはエスケープ
          result.push(escapeHtml(token.content));
        } else {
          // 許可されたタグの閉じタグ
          result.push(`</${tagName}>`);
        }
      }
    }
    
    return result.join('');
  } catch (error) {
    // エラーが発生した場合は空文字列を返す
    return '';
  }
}
