"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// src/extension.ts
const vscode = __importStar(require("vscode"));
class RangeNavigatorProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    occurrences = [];
    constructor(context) {
        this.context = context;
    }
    refresh(searchResults) {
        this.occurrences = searchResults;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.occurrences);
    }
}
class TextOccurrence extends vscode.TreeItem {
    label;
    contextLine;
    lineNumber;
    position;
    command;
    constructor(label, contextLine, lineNumber, position, command) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.contextLine = contextLine;
        this.lineNumber = lineNumber;
        this.position = position;
        this.command = command;
        // 行番号と周辺のテキストを表示
        this.description = `Line ${lineNumber + 1}`;
        this.tooltip = contextLine.trim();
    }
}
function activate(context) {
    console.log('Activating Range Navigator extension');
    // プロバイダーを登録
    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    // ツリービューを作成し、表示状態を追跡するための変数
    let treeView = vscode.window.createTreeView('rangeNavigatorView', {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: true
    });
    // この変数を使ってサイドバーが表示されているかどうかを追跡
    let isTreeViewVisible = false;
    // TreeViewの可視性が変更されたときに発生するイベント
    context.subscriptions.push(treeView.onDidChangeVisibility(event => {
        isTreeViewVisible = event.visible;
        console.log(`Tree view visibility changed to: ${isTreeViewVisible}`);
        // サイドバーが表示されたときに現在の選択を使って検索
        if (isTreeViewVisible) {
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                findOccurrences(editor, selectedText, rangeNavigatorProvider);
            }
        }
    }));
    // テキスト選択が変更されたときの処理
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        // ログを追加して状態を確認
        console.log(`Selection changed, treeView visible: ${treeView.visible}`);
        // サイドバーが表示されていない場合は何もしない
        if (!treeView.visible) {
            console.log('Tree view is not visible, skipping search');
            return;
        }
        const editor = event.textEditor;
        const selection = editor.selection;
        // 選択されたテキストを取得
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            console.log(`Selected text: "${selectedText}"`);
            // 選択テキストが存在する場合は検索を実行
            if (selectedText && selectedText.length > 0) {
                findOccurrences(editor, selectedText, rangeNavigatorProvider);
            }
        }
        else {
            // 選択がない場合はリストをクリア
            console.log('No selection, clearing results');
            rangeNavigatorProvider.refresh([]);
        }
    }));
    // エディタが変更されたときの処理
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        // アクティブなエディタが変更され、サイドバーが表示されている場合
        if (editor && treeView.visible) {
            console.log('Editor changed, checking for selection');
            if (!editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                findOccurrences(editor, selectedText, rangeNavigatorProvider);
            }
            else {
                // 選択がない場合はリストをクリア
                rangeNavigatorProvider.refresh([]);
            }
        }
    }));
    // ViewContainer が表示されたときのイベント (これはAPIで直接サポートされていないため、代替方法を使用)
    let viewStateChangeDisposable = vscode.window.onDidChangeWindowState(() => {
        // ウィンドウの状態が変更されたときにツリービューの可視性を確認
        if (treeView.visible) {
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                findOccurrences(editor, selectedText, rangeNavigatorProvider);
            }
        }
    });
    context.subscriptions.push(viewStateChangeDisposable);
    context.subscriptions.push(treeView);
}
// 指定されたテキストの出現箇所をすべて検索する
async function findOccurrences(editor, searchText, provider) {
    // 検索開始のログ
    console.log(`Finding occurrences of: "${searchText}"`);
    const document = editor.document;
    const results = [];
    // 選択されたテキストが空または空白のみの場合、結果をクリアして終了
    if (!searchText || searchText.trim() === '') {
        provider.refresh([]);
        return;
    }
    try {
        // 正規表現で特殊文字をエスケープ
        const escapedText = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // 行ごとに検索
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // この行に検索テキストが含まれているかをチェック
            if (lineText.includes(searchText)) {
                let match;
                const lineRegex = new RegExp(escapedText, 'g');
                while ((match = lineRegex.exec(lineText)) !== null) {
                    const startPos = new vscode.Position(i, match.index);
                    const endPos = new vscode.Position(i, match.index + searchText.length);
                    // 結果ラベルを作成
                    const labelText = `${searchText} (${i + 1}:${match.index + 1})`;
                    // 行のコンテキストを含む (周辺テキストを表示)
                    const contextStart = Math.max(0, match.index - 20);
                    const contextEnd = Math.min(lineText.length, match.index + searchText.length + 20);
                    const contextLine = lineText.substring(contextStart, contextEnd);
                    // クリックしたらその位置に移動するコマンドを追加
                    const command = {
                        title: 'Go to Occurrence',
                        command: 'vscode.open',
                        arguments: [
                            document.uri,
                            {
                                selection: new vscode.Range(startPos, endPos),
                                preserveFocus: false
                            }
                        ]
                    };
                    results.push(new TextOccurrence(labelText, contextLine, i, startPos, command));
                }
            }
        }
        // 検索結果をプロバイダーに通知
        console.log(`Found ${results.length} occurrences`);
        provider.refresh(results);
    }
    catch (error) {
        console.error('Error in findOccurrences:', error);
        vscode.window.showErrorMessage(`Error finding occurrences: ${error}`);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map