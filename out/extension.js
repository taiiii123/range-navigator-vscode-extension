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
    searchText;
    lineText;
    lineNumber;
    startIndex;
    position;
    command;
    constructor(searchText, lineText, lineNumber, startIndex, position, command) {
        super("", vscode.TreeItemCollapsibleState.None);
        this.searchText = searchText;
        this.lineText = lineText;
        this.lineNumber = lineNumber;
        this.startIndex = startIndex;
        this.position = position;
        this.command = command;
        // テキストの切り出しサイズを調整
        const contextBefore = 20;
        const contextAfter = 30;
        const startPos = Math.max(0, startIndex - contextBefore);
        const textBefore = lineText.substring(startPos, startIndex);
        const highlightedText = lineText.substring(startIndex, startIndex + searchText.length);
        const textAfter = lineText.substring(startIndex + searchText.length, startIndex + searchText.length + contextAfter);
        // Line番号を先頭に表示するように変更
        const linePrefix = `${lineNumber + 1}: `;
        const fullText = `${linePrefix}${textBefore}${highlightedText}${textAfter}`;
        // ハイライトの位置も調整（Line XX: の分だけずらす）
        const prefixLength = linePrefix.length;
        const highlightStart = prefixLength + textBefore.length;
        const highlightEnd = highlightStart + highlightedText.length;
        this.label = {
            label: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
        // description はもう使わないので空にするか、必要に応じて別の情報を表示
        this.description = "";
        // アイコンを設定（青いアイコンを使用）
        this.iconPath = new vscode.ThemeIcon("pin", new vscode.ThemeColor("terminal.ansiBlue"));
        // ツールチップにはフルラインテキストを表示
        this.tooltip = lineText.trim();
    }
}
function activate(context) {
    console.log("Activating Range Navigator extension");
    // プロバイダーを登録
    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    // ツリービューを作成
    let treeView = vscode.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: true,
    });
    // テキスト選択が変更されたときの処理
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((event) => {
        // サイドバーが表示されていない場合は何もしない
        if (!treeView.visible) {
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
            rangeNavigatorProvider.refresh([]);
        }
    }));
    // サイドバーが表示状態になったときのイベント
    context.subscriptions.push(treeView.onDidChangeVisibility((event) => {
        if (event.visible) {
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                findOccurrences(editor, selectedText, rangeNavigatorProvider);
            }
        }
    }));
    // エディタが変更されたときの処理
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        // アクティブなエディタが変更され、サイドバーが表示されている場合
        if (editor && treeView.visible) {
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
    context.subscriptions.push(treeView);
}
// 指定されたテキストの出現箇所をすべて検索する
async function findOccurrences(editor, searchText, provider) {
    const document = editor.document;
    const results = [];
    // 選択されたテキストが空または空白のみの場合、結果をクリアして終了
    if (!searchText || searchText.trim() === "") {
        provider.refresh([]);
        return;
    }
    try {
        // 正規表現で特殊文字をエスケープ
        const escapedText = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        // 行ごとに検索
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // この行に検索テキストが含まれているかをチェック
            if (lineText.includes(searchText)) {
                let match;
                const lineRegex = new RegExp(escapedText, "g");
                while ((match = lineRegex.exec(lineText)) !== null) {
                    const startPos = new vscode.Position(i, match.index);
                    const endPos = new vscode.Position(i, match.index + searchText.length);
                    // クリックしたらその位置に移動するコマンドを追加
                    const command = {
                        title: "Go to Occurrence",
                        command: "vscode.open",
                        arguments: [
                            document.uri,
                            {
                                selection: new vscode.Range(startPos, endPos),
                                preserveFocus: false,
                            },
                        ],
                    };
                    results.push(new TextOccurrence(searchText, lineText, i, match.index, startPos, command));
                }
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
function deactivate() { }
//# sourceMappingURL=extension.js.map