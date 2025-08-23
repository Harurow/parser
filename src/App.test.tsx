import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App Component', () => {
  test('renders React Sample App title', () => {
    render(<App />);
    const titleElement = screen.getByText(/React Sample App/i);
    expect(titleElement).toBeInTheDocument();
  });

  test('renders TypeScript support message', () => {
    render(<App />);
    const messageElement = screen.getByText(/TypeScript対応/i);
    expect(messageElement).toBeInTheDocument();
  });

  test('counter functionality works correctly', () => {
    render(<App />);
    
    // 初期値が0であることを確認
    const countValue = screen.getByText('0');
    expect(countValue).toBeInTheDocument();
    
    // +1ボタンをクリック
    const incrementButton = screen.getByText('+1');
    fireEvent.click(incrementButton);
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // -1ボタンをクリック
    const decrementButton = screen.getByText('-1');
    fireEvent.click(decrementButton);
    expect(screen.getByText('0')).toBeInTheDocument();
    
    // 複数回クリックしてからリセット
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);
    expect(screen.getByText('3')).toBeInTheDocument();
    
    const resetButton = screen.getByText('リセット');
    fireEvent.click(resetButton);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('message input functionality works correctly', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    const input = screen.getByPlaceholderText('メッセージを入力してください');
    expect(input).toBeInTheDocument();
    
    // メッセージを入力
    await user.type(input, 'Hello TypeScript!');
    
    // 入力されたメッセージが表示されることを確認
    expect(screen.getByText('入力されたメッセージ:')).toBeInTheDocument();
    expect(screen.getByText('Hello TypeScript!')).toBeInTheDocument();
  });

  test('message display only appears when there is input', () => {
    render(<App />);
    
    // 初期状態ではメッセージ表示がないことを確認
    expect(screen.queryByText('入力されたメッセージ:')).not.toBeInTheDocument();
    
    const input = screen.getByPlaceholderText('メッセージを入力してください');
    
    // メッセージを入力
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    // メッセージ表示が現れることを確認
    expect(screen.getByText('入力されたメッセージ:')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
    
    // メッセージをクリア
    fireEvent.change(input, { target: { value: '' } });
    
    // メッセージ表示が消えることを確認
    expect(screen.queryByText('入力されたメッセージ:')).not.toBeInTheDocument();
  });

  test('all buttons have correct CSS classes', () => {
    render(<App />);
    
    const incrementButton = screen.getByText('+1');
    const decrementButton = screen.getByText('-1');
    const resetButton = screen.getByText('リセット');
    
    expect(incrementButton).toHaveClass('btn', 'btn-primary');
    expect(decrementButton).toHaveClass('btn', 'btn-danger');
    expect(resetButton).toHaveClass('btn', 'btn-secondary');
  });
});
