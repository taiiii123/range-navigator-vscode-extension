<div align="right" style="font-size: 20px;">

[English](./README.md) | **日本語**

</div>


<p align="center"><img src="./resources/title.png" height=120 style="filter: drop-shadow(10px 10px 10px rgba(0, 0, 0, 0.5));"/></p>


<p align="center">
  <a href="#機能概要">機能概要 </a> •
  <a href="#インストール">インストール</a> •
  <a href="#使用方法">使用方法</a> •
  <a href="#コマンド">コマンド</a> •
  <a href="#エディタのコンテキストメニュー">エディタのコンテキストメニュー</a> •
  <a href="#設定">設定</a> •
  <a href="#サポートされている言語">サポートされている言語</a> •
  <a href="#変更履歴">変更履歴</a> •
  <a href="#ライセンス">ライセンス</a>
</p>

# **Range Navigator** - VS Code拡張機能 🔍

**Range Navigator** は、エディタ内で選択したテキストのすべての出現箇所を検索し、サイドバーに一覧表示する VS Code 拡張機能です。
一覧から項目を選択すると、該当箇所へジャンプしてハイライト表示されます。

### 🎬動作例

<a id="機能概要"></a>

# 機能概要 ✨

### 基本機能

- 🔍エディタでテキストを選択すると、同じテキストの出現箇所をすべて検索して表示
- 🖌️クリックで出現箇所にジャンプし、ハイライト表示
- 🕒検索履歴を保存し、過去の検索結果に簡単にアクセス
- 📂検索結果を展開・折りたたみ可能
- 📝行番号付きで出現箇所のコンテキストを表示
- 🎨カスタマイズ可能なハイライト色とスタイル

<a id="インストール"></a>

# インストール 📥
1. VS Code の拡張機能サイドバーを開く（左端のパズルピースアイコン）
2. 検索ボックスに「Range Navigator」と入力
3. 「インストール」ボタンをクリック

または、クイックオープン（`Ctrl+P` または `Cmd+P`）で以下のコマンドを実行:

```
ext install range-navigator
```

<a id="使用方法"></a>

# 使用方法 📖

### 基本的な使用方法
1. テキストを選択: エディタでテキストを選択します
2. 結果の確認: Range Navigator のアイコンがアクティビティバーに表示されるので、クリックしてサイドバーを開きます
3. サイドバーで確認: サイドバーに選択したテキストの出現箇所が表示されます
4. ナビゲート: リスト内の項目をクリックすると、そのコード位置にジャンプします


### 履歴機能の使用方法
1. Range Navigatorのサイドバーで履歴アイコン（🕒）をクリック
2. 過去の検索履歴が表示されます
3. 履歴項目をクリックして、その位置にジャンプ

> ℹ️通常検索モードに戻るには、再度履歴アイコン（🕒）をクリックします。

<a id="コマンド"></a>

# コマンド ⌨️
Range Navigatorでは以下のコマンドが利用できます：
| コマンド                              | 説明                                                         |
| :------------------------------------ | :----------------------------------------------------------- |
| `range-navigator.findOccurrences`     | 出現箇所を検索（選択テキストがなければ入力プロンプトを表示） |
| `range-navigator.clearSearch`         | 現在の検索結果をクリア                                       |
| `range-navigator.clearHighlightsOnly` | ハイライト表示のみをクリア                                   |
| `range-navigator.expandAll`           | すべての検索結果を展開                                       |
| `range-navigator.collapseAll`         | すべての検索結果を折りたたむ                                 |
| `range-navigator.showSearchHistory`   | 検索履歴を表示                                               |
| `range-navigator.clearHistory`        | 保存された検索履歴をクリア                                   |
|                                       |                                                              |

<a id="エディタのコンテキストメニュー"></a>

# エディタのコンテキストメニュー 📋

エディタ内で右クリックすると、コンテキストメニューに「Range Navigator」が表示されます
- 出現箇所を検索 - 選択テキストの出現箇所を検索
- ハイライトのみをクリア - ハイライト表示のみをクリア

<a id="設定"></a>

# 設定 ⚙️

### 設定のカスタマイズ

設定のカスタマイズは以下の方法または[settings.json](#settingsjson)から変更できます。

1. VSCodeメニューから`ファイル > ユーザー設定 > 設定`を開きます。
2. 検索バーに「Range Navigator」と入力します。
3. 以下の設定項目が表示されます：
   - 🎨 Background Color：ハイライトの背景色 - 検索結果をクリックしたときに表示される行の背景色を設定します。透明度を含むRGBA形式で指定できます。
   - 🖋️ Border Color：ハイライトの境界線色 - 検索結果をクリックしたときの行の境界線の色を設定します。より明確に行を強調するために使用されます。
   - 📊 Scrollbar Color：スクロールバー色 - エディタの右側のスクロールバーに表示されるマーカーの色を設定します。長いファイル内での検索結果の位置を視覚的に把握するのに役立ちます。
   - 🔢 Max Size：履歴最大サイズ - 保存される検索履歴の最大数を1から30の間で指定します。多くの検索を行う場合は大きい値を設定すると便利です。
   - 🔄 Auto Show Sidebar On Search：自動サイドバー表示 - テキストを選択したときに自動的にサイドバーを開き検索結果を表示するかどうかを設定します。頻繁に検索機能を使用する場合に便利です。

### settings.json

`settings.json`ファイルで拡張機能の[設定](https://code.visualstudio.com/docs/customization/userandworkspace)を変更できます：

### ハイライト設定
- `rangeNavigator.highlight.backgroundColor` - ハイライトの背景色
  - デフォルト: `"rgba(255, 165, 0, 0.3)"`
- `rangeNavigator.highlight.borderColor` - ハイライトの境界線の色
  - デフォルト: `"rgba(255, 140, 0, 0.8)"`
- `rangeNavigator.highlight.scrollbarColor` - スクロールバーのマーカー色
  - デフォルト: `"rgba(255, 165, 0, 0.7)"`

### 動作設定
- `rangeNavigator.history.maxSize` - 保存する履歴の最大数（1〜30）
  - デフォルト: `10`
- `rangeNavigator.autoShowSidebarOnSearch` - テキスト選択時に自動的にサイドバーを表示
  - デフォルト: `false`

#### 設定例

```json
{
  "rangeNavigator.highlight.backgroundColor": "rgba(65, 105, 225, 0.2)",
  "rangeNavigator.highlight.borderColor": "rgba(65, 105, 225, 0.7)",
  "rangeNavigator.highlight.scrollbarColor": "rgba(65, 105, 225, 0.7)",
  "rangeNavigator.autoShowSidebarOnSearch": true,
  "rangeNavigator.history.maxSize": 30
}
```

<a id="サポートされている言語"></a>

# サポートされている言語
以下の言語では、コード構造（クラス、関数など）に基づいた構造化表示をサポートしています：

- JavaScript/TypeScript
- Java

その他の言語でも基本的な検索機能は使用できます。

<a id="変更履歴"></a>

# 変更履歴 📝
すべての変更内容は[CHANGELOG](./CHANGELOG.md)で確認できます。

<a id="ライセンス"></a>

# ライセンス ⚖️
[MIT](./LICENSE)
