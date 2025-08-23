# HTMLトークナイザー テストガイド

## テストの概要

このディレクトリには、HTMLトークナイザーの包括的なテストスイートが含まれています。

## テストファイル構成

### 1. `Tokenizer.test.ts` - 基本機能テスト
- **基本的なHTMLパース**: プレーンテキスト、単純なタグ、ネストしたタグ
- **属性処理**: 各種クォートタイプ、複数属性、空属性値
- **自己終了タグ**: `<img />`, `<br />`, `<hr />` など
- **エッジケース**: 空文字列、不完全なタグ、無効な文字
- **特殊文字**: HTMLエンティティ、属性値内の特殊文字
- **パフォーマンス**: 大きなドキュメント、深いネスト
- **状態管理**: running状態、複数回のwrite呼び出し

### 2. `Tokenizer.integration.test.ts` - 統合テスト
- **実際のHTMLドキュメント**: 完全なHTMLページ、フォーム、テーブル
- **複雑な属性パターン**: データ属性、イベントハンドラー、CSS
- **エラー耐性**: 不正なネスト、引用符不一致、コメント
- **パフォーマンスと制限**: 長い属性値、多数の属性、深いネスト
- **実用的なパターン**: ナビゲーション、カードレイアウト

## テストの実行方法

```bash
# 基本テストの実行
npm test Tokenizer.test.ts

# 統合テストの実行
npm test Tokenizer.integration.test.ts

# 全テストの実行
npm test

# カバレッジ付きテスト実行
npm test -- --coverage

# 監視モードでテスト実行
npm test -- --watch
```

## テストケースの分類

### 🟢 基本機能テスト
- ✅ プレーンテキストのパース
- ✅ 単純なタグ構造
- ✅ ネストしたタグ
- ✅ 複数のテキストノード

### 🔵 属性処理テスト
- ✅ 値なし属性 (`disabled`)
- ✅ ダブルクォート属性 (`class="container"`)
- ✅ シングルクォート属性 (`class='container'`)
- ✅ クォートなし属性 (`class=container`)
- ✅ 複数属性の組み合わせ
- ✅ 空の属性値
- ✅ 属性値内のスペース

### 🟡 自己終了タグテスト
- ✅ 基本的な自己終了タグ (`<img />`)
- ✅ 属性なし自己終了タグ (`<br />`)
- ✅ スペースなし自己終了タグ (`<hr/>`)

### 🔴 エラーハンドリングテスト
- ✅ 空文字列の処理
- ✅ 不完全なタグ
- ✅ 不完全な属性
- ✅ 閉じられていないクォート
- ✅ 無効なタグ名文字
- ✅ 連続する空白文字
- ✅ 改行を含むHTML

### 🟣 特殊ケーステスト
- ✅ HTMLエンティティ
- ✅ 属性値内の特殊文字
- ✅ 大きなHTMLドキュメント
- ✅ 深くネストしたHTML

## カバレッジ目標

- **行カバレッジ**: 95%以上
- **関数カバレッジ**: 100%
- **分岐カバレッジ**: 90%以上

## テストデータパターン

### 基本的なHTMLパターン
```html
<!-- 単純なタグ -->
<div>Hello World</div>

<!-- 属性付きタグ -->
<div class="container" id="main">Content</div>

<!-- 自己終了タグ -->
<img src="image.jpg" alt="Image" />

<!-- ネストしたタグ -->
<div><span>Nested</span></div>
```

### 複雑なHTMLパターン
```html
<!-- フォーム -->
<form action="/submit" method="post">
  <input type="text" name="username" required>
  <button type="submit">Submit</button>
</form>

<!-- テーブル -->
<table>
  <thead><tr><th>Header</th></tr></thead>
  <tbody><tr><td>Data</td></tr></tbody>
</table>
```

### エラーケース
```html
<!-- 不完全なタグ -->
<div>Unclosed tag

<!-- 不正な属性 -->
<div class="unclosed quote>Content</div>

<!-- 無効なタグ名 -->
<123invalid>Content</123invalid>
```

## パフォーマンステスト

### 測定項目
- **パース速度**: 大きなドキュメントの処理時間
- **メモリ使用量**: 深いネスト構造での消費メモリ
- **スケーラビリティ**: ドキュメントサイズに対する線形性

### ベンチマーク目標
- 1MB HTMLドキュメント: < 100ms
- 100レベル深いネスト: < 50ms
- 1000個の属性: < 20ms

## モックとヘルパー

### MockCallbacks クラス
```typescript
// イベントの記録と検証
const callbacks = new MockCallbacks();
const tokenizer = new Tokenizer(callbacks);
tokenizer.write(html);

// 結果の検証
expect(callbacks.getTextContent(html)).toBe('Expected text');
expect(callbacks.getTagNames(html)).toEqual(['div', 'span']);
```

### DetailedCallbacks クラス
```typescript
// 構造化された解析結果
const structure = parseToStructure(html);
expect(structure[0].tagName).toBe('div');
expect(structure[0].attributes[0].name).toBe('class');
```

## 継続的改善

### 新しいテストケースの追加
1. 実際の使用例から問題を特定
2. 最小限の再現ケースを作成
3. 期待される動作を定義
4. テストケースを追加

### パフォーマンス監視
1. 定期的なベンチマーク実行
2. 回帰の早期発見
3. 最適化の効果測定

### エラーケースの拡充
1. 実際のWebサイトからの不正なHTML収集
2. ブラウザとの動作比較
3. 堅牢性の向上
