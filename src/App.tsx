import React, { useState } from 'react';
import './App.css';
import SanitizeParser from './SanitizeParser/SanitizeParser';

function sanitizeHTML(input: string): string {
  const parser = new SanitizeParser();
  const result = parser.sanitize(input);
  return result.html;
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
