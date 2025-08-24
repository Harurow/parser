import React, { useState } from 'react';
import './App.css';
import Parser, { type Handler } from './htmlparser/Parser';

function sanitizeHTML(input: string): string {
  // HTMLエスケープ関数
  function escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 許可されたタグと属性のリスト
  const allowedTags: Record<string, string[]> = {
    'a': ['href'],
    'font': ['size', 'color'],
    'u': [],
    'strong': [],
    'li': [],
    'ul': [],
    'br': []
  };

  try {
    const parser = new Parser();
    const tokens = parser.parse(input);

    let result = '';

    for (const token of tokens) {
      if (token.type === 'text') {
        // テキストトークンはそのまま追加
        result += input.slice(token.startIndex, token.endIndex);
      } else if (token.type === 'openTag') {
        const tagName = token.tagName.toLowerCase();

        if (allowedTags[tagName]) {
          // 許可されたタグの場合
          let tagStr = `<${token.tagName}`;

          // 許可された属性のみを追加
          if (token.attributes) {
            const allowedAttrs = allowedTags[tagName];
            for (const attr of token.attributes) {
              if (allowedAttrs.includes(attr.name.toLowerCase()) && attr.value?.value) {
                tagStr += ` ${attr.name}="${attr.value.value}"`;
              }
            }
          }

          if (token.selfClosing) {
            tagStr += ' />';
          } else {
            tagStr += '>';
          }

          result += tagStr;
        } else {
          // 許可されていないタグはエスケープ
          result += escapeHTML(input.slice(token.startIndex, token.endIndex));
        }
      } else if (token.type === 'closeTag') {
        const tagName = token.tagName.toLowerCase();

        if (allowedTags[tagName]) {
          // 許可されたタグの場合
          result += `</${token.tagName}>`;
        } else {
          // 許可されていないタグはエスケープ
          result += escapeHTML(input.slice(token.startIndex, token.endIndex));
        }
      }
    }

    return result;
  } catch (error) {
    // パースエラーの場合は全体をエスケープ
    return escapeHTML(input);
  }
}

const App: React.FC = () => {
  const [count, setCount] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [sanitized, setSanitized] = useState<string>('');

  const handleIncrement = (): void => {
    setCount(count + 1);
  };

  const handleDecrement = (): void => {
    setCount(count - 1);
  };

  const handleReset = (): void => {
    setCount(0);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const input = e.target.value;
    setMessage(input);
    const output = sanitizeHTML(input); // サニタイズ関数の呼び出し
    setSanitized(output);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>React Sample App</h1>
        <p>Node.jsとReactのサンプルアプリケーションです（TypeScript対応）</p>
      </header>

      <main className="App-main">
        <section className="counter-section">
          <h2>カウンター</h2>
          <div className="counter-display">
            <span className="count-value">{count}</span>
          </div>
          <div className="counter-buttons">
            <button onClick={handleDecrement} className="btn btn-danger">
              -1
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              リセット
            </button>
            <button onClick={handleIncrement} className="btn btn-primary">
              +1
            </button>
          </div>
        </section>

        <section className="message-section">
          <h2>メッセージ入力</h2>
          <div className="input-group">
            <input
              type="text"
              value={message}
              onChange={handleMessageChange}
              placeholder="メッセージを入力してください"
              className="message-input"
            />
          </div>
          {message && (
            <div className="message-display">
              <p>入力されたメッセージ(処理済み):</p>
              <div dangerouslySetInnerHTML={{__html: sanitized}}></div>
              <p>入力されたメッセージ:raw</p>
              <div dangerouslySetInnerHTML={{__html: message}}></div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
