import React, { useState } from 'react';
import './App.css';
import SanitizeParser from './SanitizeParser/SanitizeParser';

function sanitizeHTML(input: string): string {
  const parser = new SanitizeParser({
    allowedTags: [
      { tagName: 'strong' },
      { tagName: 'u' },
      { tagName: 'ul' },
      { tagName: 'li' },
      { tagName: 'br' },
      { tagName: 'font',
        onAttribute: (name, _) => {
          if (name === 'color' || name === 'size' || name === 'face') {
            return true;
          }
          return false;
        }
       },
      { tagName: 'a',
        onAttribute: (name, value) => {
          if (name === 'href') {
            return /^https?:\/\//.test(value);
          }
          return false;
        },
        defaultAttributes: { target: '_blank', rel: 'noopener noreferrer' }
      }
    ],
  });
  const result = parser.sanitize(input);
  return result.html;
}

const App: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [sanitized, setSanitized] = useState<string>('');

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
              <p>入力されたメッセージ:sanitized</p>
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
