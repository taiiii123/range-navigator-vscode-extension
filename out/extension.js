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
const vscode = __importStar(require("vscode"));
// グローバル変数としてデコレーションタイプを宣言
let highlightDecorationType;
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
        return Promise.resolve(element ? [] : this.occurrences);
    }
}
class TextOccurrence extends vscode.TreeItem {
    searchText;
    lineText;
    lineNumber;
    startIndex;
    position;
    command;
    // ハイライト用の行範囲を追加
    lineRange;
    constructor(searchText, lineText, lineNumber, startIndex, position, command) {
        super("", vscode.TreeItemCollapsibleState.None);
        this.searchText = searchText;
        this.lineText = lineText;
        this.lineNumber = lineNumber;
        this.startIndex = startIndex;
        this.position = position;
        this.command = command;
        // 行全体の範囲を保存
        this.lineRange = new vscode.Range(lineNumber, 0, lineNumber, lineText.length);
        // テキストのコンテキストを準備
        const contextBefore = 20;
        const contextAfter = 30;
        const startPos = Math.max(0, startIndex - contextBefore);
        const textBefore = lineText.substring(startPos, startIndex);
        const highlightedText = lineText.substring(startIndex, startIndex + searchText.length);
        const textAfter = lineText.substring(startIndex + searchText.length, Math.min(lineText.length, startIndex + searchText.length + contextAfter));
        // 表示テキストを構築
        const linePrefix = `${lineNumber + 1}:  `;
        const fullText = `${linePrefix}${textBefore}${highlightedText}${textAfter}`;
        // ハイライト位置を調整
        const prefixLength = linePrefix.length;
        const highlightStart = prefixLength + textBefore.length;
        const highlightEnd = highlightStart + highlightedText.length;
        this.label = {
            label: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
        this.description = "";
        this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));
        this.tooltip = lineText.trim();
    }
}
function activate(context) {
    console.log("Activating Range Navigator extension");
    // ハイライト用のデコレーションタイプを作成
    highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 165, 0, 0.3)',
        border: '1px solid',
        borderColor: 'rgba(255, 140, 0, 0.8)',
        isWholeLine: true
    });
    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    const treeView = vscode.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: false,
    });
    // クリックされた行への移動とハイライト表示を行うコマンド
    context.subscriptions.push(vscode.commands.registerCommand('rangeNavigator.gotoOccurrence', (docUri, position, range, searchTextLength) => {
        vscode.window.showTextDocument(docUri).then(editor => {
            // 検索テキストの範囲全体を選択
            const selectionEnd = new vscode.Position(position.line, position.character + searchTextLength);
            editor.selection = new vscode.Selection(position, selectionEnd);
            // 見やすいようにスクロール位置を調整
            editor.revealRange(new vscode.Range(position, selectionEnd), vscode.TextEditorRevealType.InCenter);
            // 行ハイライトを適用
            setTimeout(() => highlightSelectedLine(editor, range), 100);
        });
    }));
    // 選択テキスト変更イベントハンドラ
    const handleSelectionChange = (editor) => {
        if (!editor || !treeView.visible) {
            return;
        }
        ;
        const selection = editor.selection;
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            if (selectedText && selectedText.length > 0) {
                console.log(`Selected text: "${selectedText}"`);
                findOccurrences(editor, selectedText, rangeNavigatorProvider);
            }
        }
        else {
            rangeNavigatorProvider.refresh([]);
            clearHighlights(editor);
        }
    };
    // テキスト選択変更イベント
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((event) => {
        handleSelectionChange(event.textEditor);
    }));
    // サイドバー表示状態変更イベント
    context.subscriptions.push(treeView.onDidChangeVisibility((event) => {
        if (event.visible) {
            handleSelectionChange(vscode.window.activeTextEditor);
        }
        else if (vscode.window.activeTextEditor) {
            clearHighlights(vscode.window.activeTextEditor);
        }
    }));
    // エディタ変更イベント
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (treeView.visible) {
            handleSelectionChange(editor);
        }
    }));
    context.subscriptions.push(treeView);
}
// ハイライトを消去する関数
function clearHighlights(editor) {
    editor.setDecorations(highlightDecorationType, []);
}
// 指定された行をハイライトする関数
function highlightSelectedLine(editor, range) {
    clearHighlights(editor);
    editor.setDecorations(highlightDecorationType, [range]);
    console.log(`Highlighting line ${range.start.line + 1}`);
}
// 指定されたテキストの出現箇所をすべて検索する
async function findOccurrences(editor, searchText, provider) {
    const document = editor.document;
    const results = [];
    // 選択テキストが空の場合は早期リターン
    if (!searchText || searchText.trim() === "") {
        provider.refresh([]);
        return;
    }
    try {
        // 正規表現で特殊文字をエスケープ
        const escapedText = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const searchRegex = new RegExp(escapedText, "g");
        // ドキュメント内の各行を検索
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // 検索テキストが含まれている場合のみ処理
            if (!lineText.includes(searchText))
                continue;
            let match;
            searchRegex.lastIndex = 0; // 正規表現のindexをリセット
            while ((match = searchRegex.exec(lineText)) !== null) {
                const startPos = new vscode.Position(i, match.index);
                // 行全体の範囲を取得
                const lineRange = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, lineText.length));
                // コマンド設定
                const command = {
                    title: "Go to Occurrence",
                    command: "rangeNavigator.gotoOccurrence",
                    arguments: [document.uri, startPos, lineRange, searchText.length],
                };
                results.push(new TextOccurrence(searchText, lineText, i, match.index, startPos, command));
            }
        }
        // 検索結果をプロバイダーに通知
        provider.refresh(results);
    }
    catch (error) {
        console.error("Error in findOccurrences:", error);
        vscode.window.showErrorMessage(`Error finding occurrences: ${error}`);
    }
}
function deactivate() {
    if (highlightDecorationType) {
        highlightDecorationType.dispose();
    }
}
//# sourceMappingURL=extension.js.map