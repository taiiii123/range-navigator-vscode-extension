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
const vscode_1 = __importStar(require("vscode"));
// グローバル変数としてデコレーションタイプを宣言
let highlightDecorationType;
// 最後に検索したテキストを保持するグローバル変数
let lastSearchedText = '';
// 選択がサイドバーからのものかを判断するフラグ
let isNavigatingFromSidebar = false;
// 初期表示済みフラグ
let hasShownWelcomeMessage = false;
// 階層構造をサポートするための拡張したTreeItemクラス
class TreeNode extends vscode_1.default.TreeItem {
    children = [];
    // parentを読み書き可能なプロパティとして定義
    parentNode;
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
    }
    addChild(child) {
        this.children.push(child);
        child.parentNode = this;
    }
}
// ウェルカムメッセージノード
class WelcomeMessageNode extends TreeNode {
    constructor() {
        // 言語に基づいてメッセージを変更
        const message = vscode_1.l10n.t('Welcome to Range Navigator! 🔍');
        super(message, vscode_1.default.TreeItemCollapsibleState.None);
        this.iconPath = new vscode_1.default.ThemeIcon("star");
        // ツールチップも言語に基づいて設定
        this.tooltip = vscode_1.l10n.t('Range Navigator helps you find and visualize occurrences of selected text in your code.');
    }
}
// 使用方法ノード
class UsageInfoNode extends TreeNode {
    constructor() {
        // 言語に基づいてタイトルを変更
        const messageTitle = vscode_1.l10n.t('How to use:');
        super(messageTitle, vscode_1.default.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode_1.default.ThemeIcon("info");
        // 言語に基づいて使用方法の詳細を追加
        this.addChild(new InstructionNode(vscode_1.l10n.t('1. Select text in the editor'), 'selection'));
        this.addChild(new InstructionNode(vscode_1.l10n.t('2. All occurrences will be shown here'), 'list-tree'));
        this.addChild(new InstructionNode(vscode_1.l10n.t('3. Click on an item to navigate to it'), 'go-to-file'));
        this.addChild(new InstructionNode(vscode_1.l10n.t('4. Selected occurrences are highlighted'), 'symbol-color'));
    }
}
// 使用方法の各ステップノード
class InstructionNode extends TreeNode {
    constructor(instruction, iconName) {
        super(instruction, vscode_1.default.TreeItemCollapsibleState.None);
        this.iconPath = new vscode_1.default.ThemeIcon(iconName);
    }
}
// コード構造ノード（クラス・関数などを表す）
class CodeStructureNode extends TreeNode {
    name;
    type;
    range;
    document;
    constructor(name, type, range, document, collapsibleState = vscode_1.default.TreeItemCollapsibleState.Expanded) {
        super(name, collapsibleState);
        this.name = name;
        this.type = type;
        this.range = range;
        this.document = document;
        // アイコンの設定
        switch (type) {
            case 'class':
                this.iconPath = new vscode_1.default.ThemeIcon("symbol-class");
                break;
            case 'function':
                this.iconPath = new vscode_1.default.ThemeIcon("symbol-function");
                break;
            case 'method':
                this.iconPath = new vscode_1.default.ThemeIcon("symbol-method");
                break;
            default:
                this.iconPath = new vscode_1.default.ThemeIcon("symbol-misc");
        }
        // 設定からナビゲーション機能の有効/無効を取得
        const config = vscode_1.default.workspace.getConfiguration('rangeNavigator');
        const enableNavigation = config.get('enableNavigationOnClick', true);
        // 設定が有効な場合のみコマンドを設定
        if (enableNavigation) {
            // コマンドの設定（クリックでソースコードの位置に移動）
            this.command = {
                title: "Go to Definition",
                command: "rangeNavigator.gotoDefinition",
                arguments: [document.uri, range.start, range]
            };
        }
    }
}
class TextOccurrence extends TreeNode {
    searchText;
    lineText;
    lineNumber;
    startIndex;
    position;
    document;
    // ハイライト用の行範囲を追加
    lineRange;
    highlightInfo;
    constructor(searchText, lineText, lineNumber, startIndex, position, document, command) {
        // TreeNodeの親クラスのコンストラクタにラベルを直接渡さない
        super("", vscode_1.default.TreeItemCollapsibleState.None);
        this.searchText = searchText;
        this.lineText = lineText;
        this.lineNumber = lineNumber;
        this.startIndex = startIndex;
        this.position = position;
        this.document = document;
        // 行全体の範囲を保存
        this.lineRange = new vscode_1.default.Range(lineNumber, 0, lineNumber, lineText.length);
        // テキストのコンテキストを準備
        const contextBefore = 20;
        const contextAfter = 30;
        const startPos = Math.max(0, startIndex - contextBefore);
        const textBefore = lineText.substring(startPos, startIndex);
        const highlightedText = lineText.substring(startIndex, startIndex + searchText.length);
        const textAfter = lineText.substring(startIndex + searchText.length, Math.min(lineText.length, startIndex + searchText.length + contextAfter));
        // 表示テキストを構築
        let linePrefix = `${lineNumber + 1}:  `;
        if (vscode_1.l10n.t('language') === 'ja') {
            linePrefix = `${lineNumber + 1} 行目:  `;
        }
        else {
            linePrefix = `Line ${lineNumber + 1}:  `;
        }
        const fullText = `${linePrefix}${textBefore}${highlightedText}${textAfter}`;
        // ハイライト位置を調整
        const prefixLength = linePrefix.length;
        const highlightStart = prefixLength + textBefore.length;
        const highlightEnd = highlightStart + highlightedText.length;
        // TreeItemLabelを設定（コンストラクタでラベルを設定後に上書き）
        this.highlightInfo = {
            fullText: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
        // ラベルオブジェクトを設定（直接this.labelに代入はできない）
        this.label = {
            label: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
        this.iconPath = new vscode_1.default.ThemeIcon("list-selection", new vscode_1.default.ThemeColor("terminal.ansiBlue"));
        this.tooltip = lineText.trim();
        // コマンドが指定されていなければデフォルトコマンドを設定
        if (!command) {
            this.command = {
                title: "Go to Occurrence",
                command: "rangeNavigator.gotoOccurrence",
                arguments: [document.uri, position, this.lineRange, searchText.length],
            };
        }
        else {
            this.command = command;
        }
    }
}
class RangeNavigatorProvider {
    context;
    _onDidChangeTreeData = new vscode_1.default.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    rootNodes = [];
    constructor(context) {
        this.context = context;
        // 初期表示用のウェルカムメッセージを設定
        this.showWelcomeMessage();
    }
    // ウェルカムメッセージを表示
    showWelcomeMessage() {
        // ウェルカムメッセージのルートノードを作成
        const welcomeNode = new WelcomeMessageNode();
        const usageNode = new UsageInfoNode();
        this.rootNodes = [welcomeNode, usageNode];
        this._onDidChangeTreeData.fire();
        // ウェルカムメッセージを表示済みとしてマーク
        hasShownWelcomeMessage = true;
    }
    refresh(rootNodes) {
        this.rootNodes = rootNodes;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.rootNodes);
        }
        return Promise.resolve(element.children);
    }
    getParent(element) {
        return element.parentNode;
    }
}
// コードの構造（クラス、関数など）を解析する機能
async function parseCodeStructure(document) {
    const structures = [];
    // 簡易的なパターンマッチング（より高度な解析にはパーサーライブラリ使用を推奨）
    // クラス定義: Java, Python, C#, C++, Swift, Kotlin, Dart などに対応
    const classPattern = /\bclass\s+(\w+)(?:\s+extends\s+\w+|\s*:\s*\w+)?/g;
    // 関数定義: JavaScript, Python, PHP, Go, Rust, Swift, Kotlin, Dart, Scala, Ruby など対応
    const functionPattern = /\b(?:function|def|fn|func|fun)\s+(\w+)\s*\([^)]*\)/g;
    // メソッド定義: アクセス修飾子やstaticを含むJava, C#, TypeScript, Dartなどに対応
    const methodPattern = /\b(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
    const text = document.getText();
    let match;
    // クラスを検索
    while ((match = classPattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        // クラスの終了位置を簡易的に特定（実際には構文解析が必要）
        const classEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
        const endPos = classEndIndex !== -1 ? document.positionAt(classEndIndex) : document.positionAt(text.length);
        const range = new vscode_1.default.Range(startPos, endPos);
        structures.push(new CodeStructureNode(match[1], 'class', range, document));
    }
    // 関数を検索
    while ((match = functionPattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const funcEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
        const endPos = funcEndIndex !== -1 ? document.positionAt(funcEndIndex) : document.positionAt(text.length);
        const range = new vscode_1.default.Range(startPos, endPos);
        structures.push(new CodeStructureNode(match[1], 'function', range, document));
    }
    // メソッドを検索（簡易的な実装）
    while ((match = methodPattern.exec(text)) !== null) {
        // クラス内のメソッドか確認（簡易的）
        let isClassMethod = false;
        let parentClass;
        for (const structure of structures) {
            if (structure.type === 'class' &&
                structure.range.contains(document.positionAt(match.index))) {
                isClassMethod = true;
                parentClass = structure;
                break;
            }
        }
        if (isClassMethod && parentClass) {
            const startPos = document.positionAt(match.index);
            const methodEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
            const endPos = methodEndIndex !== -1 ? document.positionAt(methodEndIndex) : document.positionAt(text.length);
            const range = new vscode_1.default.Range(startPos, endPos);
            const methodNode = new CodeStructureNode(match[1], 'method', range, document);
            // メソッドをクラスの子ノードとして追加
            parentClass.addChild(methodNode);
        }
    }
    return structures;
}
// 対応する閉じ括弧を見つける簡易的な関数
function findMatchingBrace(text, startOffset) {
    let braceCount = 0;
    let inBraces = false;
    for (let i = startOffset; i < text.length; i++) {
        const char = text[i];
        if (char === '{') {
            braceCount++;
            inBraces = true;
        }
        else if (char === '}') {
            braceCount--;
            if (inBraces && braceCount === 0) {
                return i + 1; // 閉じ括弧の次の位置
            }
        }
    }
    return -1; // 対応する閉じ括弧が見つからない
}
// 検索結果をコード構造と関連付ける
function organizeOccurrencesByStructure(occurrences, structures, document) {
    // 構造化された新しいノードツリーを作成
    const rootNodes = [];
    // まず、構造ノードの新しいインスタンスを作成
    for (const structure of structures) {
        const newNode = new CodeStructureNode(structure.name, structure.type, structure.range, document);
        // 子ノードを再帰的に処理
        for (const child of structure.children) {
            if (child instanceof CodeStructureNode) {
                const childNode = new CodeStructureNode(child.name, child.type, child.range, document);
                newNode.addChild(childNode);
            }
        }
        rootNodes.push(newNode);
    }
    // 未分類の検索結果を格納するノード
    const uncategorizedNode = new TreeNode(vscode_1.l10n.t("📍 Other Occurrences"), vscode_1.default.TreeItemCollapsibleState.Expanded);
    let hasUncategorized = false;
    // 各出現箇所を適切な構造に割り当て
    for (const occurrence of occurrences) {
        const position = occurrence.position;
        let matched = false;
        // 出現箇所がどの構造に属するか確認
        for (let i = 0; i < structures.length; i++) {
            const structure = structures[i];
            if (structure.range.contains(position)) {
                // 該当する構造のノードに追加
                rootNodes[i].addChild(occurrence);
                matched = true;
                break;
            }
            // ネストされたメソッドを確認
            for (let j = 0; j < structure.children.length; j++) {
                const child = structure.children[j];
                if (child instanceof CodeStructureNode && child.range.contains(position)) {
                    // ツリー内の対応するノードを検索して追加
                    const parentNode = rootNodes[i];
                    if (parentNode && parentNode.children[j]) {
                        parentNode.children[j].addChild(occurrence);
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) {
                break;
            }
            ;
        }
        // どの構造にも属さない場合は「その他」に分類
        if (!matched) {
            uncategorizedNode.addChild(occurrence);
            hasUncategorized = true;
        }
    }
    // 子ノードを持たない構造ノードを削除
    const filteredRootNodes = rootNodes.filter(node => node.children.length > 0);
    // 未分類の出現箇所があれば追加
    if (hasUncategorized) {
        filteredRootNodes.push(uncategorizedNode);
    }
    return filteredRootNodes;
}
function activate(context) {
    console.log("Activating Range Navigator extension");
    // コンテキスト変数を初期化
    updateSearchContext(false);
    const config = vscode_1.default.workspace.getConfiguration('rangeNavigator');
    const backgroundColor = config.get('highlight.backgroundColor', 'rgba(255, 165, 0, 0.3)');
    const borderColor = config.get('highlight.borderColor', 'rgba(255, 140, 0, 0.8)');
    // 設定が変更された場合にウィンドウをリロードするためのイベントリスナーを登録
    context.subscriptions.push(vscode_1.default.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('rangeNavigator.highlight.backgroundColor')
            || e.affectsConfiguration('rangeNavigator.highlight.borderColor')
            || e.affectsConfiguration('rangeNavigator.enableNavigationOnClick')) {
            const answer = await vscode_1.default.window.showInformationMessage(vscode_1.l10n.t("Range Navigator: Settings have been changed. A window reload is required to apply the changes. Do you want to reload now?"), vscode_1.l10n.t("Yes"), vscode_1.l10n.t("No"));
            if (answer === vscode_1.l10n.t("Yes")) {
                vscode_1.default.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    }));
    // ハイライト用のデコレーションタイプを作成
    highlightDecorationType = vscode_1.default.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        border: '1px solid',
        borderColor: borderColor,
        isWholeLine: true
    });
    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    const treeView = vscode_1.default.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: false,
    });
    // ツリービューを折りたたむコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand("range-navigator.collapseAll", () => {
        console.log("Range Navigator: Collapse All");
        vscode_1.default.commands.executeCommand('workbench.actions.treeView.rangeNavigatorView.collapseAll');
    }));
    // ツリービューを展開するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand("range-navigator.expandAll", () => {
        expandAll(treeView, rangeNavigatorProvider);
    }));
    // クリックされた行への移動とハイライト表示を行うコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('rangeNavigator.gotoOccurrence', (docUri, position, range, searchTextLength) => {
        // サイドバーからのナビゲーションフラグを設定
        isNavigatingFromSidebar = true;
        vscode_1.default.window.showTextDocument(docUri).then(editor => {
            console.log(`Selected text1: "${editor.document.getText(editor.selection)}"`);
            // 検索テキストの範囲全体を選択
            const selectionEnd = new vscode_1.default.Position(position.line, position.character + searchTextLength);
            editor.selection = new vscode_1.default.Selection(position, selectionEnd);
            console.log(`Selected text2: "${editor.document.getText(editor.selection)}"`);
            // 見やすいようにスクロール位置を調整
            editor.revealRange(new vscode_1.default.Range(position, selectionEnd), vscode_1.default.TextEditorRevealType.InCenter);
            // 行ハイライトを適用
            setTimeout(() => {
                highlightSelectedLine(editor, range);
                // 操作完了後にフラグをリセット
                setTimeout(() => {
                    isNavigatingFromSidebar = false;
                }, 300);
            }, 100);
        });
    }));
    // 定義位置に移動するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('rangeNavigator.gotoDefinition', (docUri, position, range) => {
        // サイドバーからのナビゲーションフラグを設定
        isNavigatingFromSidebar = true;
        vscode_1.default.window.showTextDocument(docUri).then(editor => {
            // カーソルを定義位置に移動
            editor.selection = new vscode_1.default.Selection(position, position);
            // 見やすいようにスクロール位置を調整
            editor.revealRange(range, vscode_1.default.TextEditorRevealType.InCenter);
            // 行ハイライトを適用
            setTimeout(() => {
                highlightSelectedLine(editor, new vscode_1.default.Range(position.line, 0, position.line, editor.document.lineAt(position.line).text.length));
                // 操作完了後にフラグをリセット
                setTimeout(() => {
                    isNavigatingFromSidebar = false;
                }, 300);
            }, 100);
        });
    }));
    // 選択テキスト変更イベントハンドラ
    const handleSelectionChange = async (editor) => {
        if (!editor || !treeView.visible) {
            return;
        }
        ;
        const selection = editor.selection;
        // サイドバーからのナビゲーション中は処理をスキップ
        if (isNavigatingFromSidebar) {
            return;
        }
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            if (selectedText && selectedText.length > 0) {
                console.log(`Selected text: "${selectedText}"`);
                lastSearchedText = selectedText; // 最後に検索したテキストを保存
                await findOccurrencesInStructure(editor, selectedText, rangeNavigatorProvider);
            }
        }
        else {
            // 選択がクリアされた場合でも、最後に検索したテキストの結果を維持
            if (lastSearchedText) {
                // 何もしない - 検索結果はそのまま表示
            }
            else {
                // 検索結果がない場合はウェルカムメッセージを表示
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }
    };
    // 検索をクリアするコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('range-navigator.clearSearch', () => {
        const editor = vscode_1.default.window.activeTextEditor;
        clearSearch(rangeNavigatorProvider, editor);
    }));
    // テキスト選択変更イベント
    context.subscriptions.push(vscode_1.default.window.onDidChangeTextEditorSelection((event) => {
        handleSelectionChange(event.textEditor);
    }));
    // サイドバー表示状態変更イベント
    context.subscriptions.push(treeView.onDidChangeVisibility((event) => {
        if (event.visible) {
            // サイドバーが表示されたとき、アクティブエディタに最後の検索テキストがあればそれを使用
            const editor = vscode_1.default.window.activeTextEditor;
            if (editor && lastSearchedText) {
                findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
            }
            else if (editor) {
                handleSelectionChange(editor);
            }
            else {
                // エディタが開かれていない場合はウェルカムメッセージを表示
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }
        else if (vscode_1.default.window.activeTextEditor) {
            clearHighlights(vscode_1.default.window.activeTextEditor);
        }
    }));
    // エディタ変更イベント
    context.subscriptions.push(vscode_1.default.window.onDidChangeActiveTextEditor((editor) => {
        if (treeView.visible) {
            if (editor && lastSearchedText) {
                // 新しいエディタが開かれたとき、最後の検索テキストを使用
                findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
            }
            else if (editor) {
                handleSelectionChange(editor);
            }
            else {
                // エディタが開かれていない場合はウェルカムメッセージを表示
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }
    }));
    // 手動で検索を実行するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('range-navigator.findOccurrences', async () => {
        const editor = vscode_1.default.window.activeTextEditor;
        if (!editor) {
            return vscode_1.default.window.showWarningMessage(vscode_1.l10n.t('No active editor found.'));
        }
        const selection = editor.selection;
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            if (selectedText && selectedText.length > 0) {
                lastSearchedText = selectedText;
                await findOccurrencesInStructure(editor, selectedText, rangeNavigatorProvider);
                // サイドバーを開く
                await vscode_1.default.commands.executeCommand('rangeNavigatorView.focus');
            }
        }
        else {
            // 選択がない場合は、ユーザーに検索テキストの入力を促す
            const searchText = await vscode_1.default.window.showInputBox({
                placeHolder: vscode_1.l10n.t('Enter text to search for'),
                prompt: vscode_1.l10n.t('Search for text in the current document')
            });
            if (searchText && searchText.length > 0) {
                lastSearchedText = searchText;
                await findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider);
                // サイドバーを開く
                await vscode_1.default.commands.executeCommand('rangeNavigatorView.focus');
            }
        }
    }));
    // テキスト変更イベント - 文書が変更されたときの処理
    context.subscriptions.push(vscode_1.default.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode_1.default.window.activeTextEditor;
        if (editor && treeView.visible && event.document === editor.document && lastSearchedText) {
            // 少し遅延させて検索結果を更新（連続変更時のパフォーマンス向上）
            setTimeout(() => {
                findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
            }, 500);
        }
    }));
    context.subscriptions.push(treeView);
    // メッセージをコピーするコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('range-navigator.copyMessage', async (node) => {
        if (node && node.label) {
            // ノードのラベルをクリップボードにコピー
            let messageText = "";
            // TreeItemLabelオブジェクトかどうかを確認
            if (typeof node.label === 'object' && node.label.label) {
                messageText = node.label.label;
            }
            else if (typeof node.label === 'string') {
                messageText = node.label;
            }
            if (messageText) {
                await vscode_1.default.env.clipboard.writeText(messageText);
                vscode_1.default.window.showInformationMessage(vscode_1.l10n.t('Message copied to clipboard!'));
            }
        }
    }));
}
// すべて展開関数の定義
async function expandAll(treeView, provider) {
    const roots = await provider.getChildren();
    if (!roots) {
        return;
    }
    for (const root of roots) {
        await treeView.reveal(root, { expand: true });
        const children = await provider.getChildren(root);
        for (const child of children ?? []) {
            await treeView.reveal(child, { expand: true });
        }
    }
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
// 指定されたテキストの出現箇所をすべて検索し、コード構造と関連付ける
function updateSearchContext(hasSearchText) {
    vscode_1.default.commands.executeCommand('setContext', 'lastSearchedText', hasSearchText);
}
// findOccurrencesInStructure関数内の修正
async function findOccurrencesInStructure(editor, searchText, provider) {
    const document = editor.document;
    const results = [];
    // 明示的にboolean型に変換する
    const hasValidSearchText = Boolean(searchText && searchText.trim() !== "");
    // コンテキスト変数を更新
    updateSearchContext(hasValidSearchText);
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
            if (!lineText.includes(searchText)) {
                continue;
            }
            ;
            let match;
            searchRegex.lastIndex = 0; // 正規表現のindexをリセット
            while ((match = searchRegex.exec(lineText)) !== null) {
                const startPos = new vscode_1.default.Position(i, match.index);
                results.push(new TextOccurrence(searchText, lineText, i, match.index, startPos, document));
            }
        }
        // 検索結果が0件の場合はメッセージを表示
        if (results.length === 0) {
            // メッセージテキスト
            const messageText = vscode_1.l10n.t("No results found for: {0}", searchText);
            // メッセージノードを作成
            const noResultsNode = new TreeNode(messageText, vscode_1.default.TreeItemCollapsibleState.None);
            // アイコンを設定
            noResultsNode.iconPath = new vscode_1.default.ThemeIcon("info");
            // ツールチップを設定
            noResultsNode.tooltip = vscode_1.l10n.t("No items matching \"{0}\" were found. Right-click to copy this message.", searchText);
            // コンテキストメニューから呼び出せるようにコマンドを設定
            noResultsNode.contextValue = "noResultsMessage";
            // プロバイダーに通知
            provider.refresh([noResultsNode]);
            return;
        }
        // コード構造を解析
        const codeStructures = await parseCodeStructure(document);
        // 結果をコード構造と関連付ける
        const organizedResults = organizeOccurrencesByStructure(results, codeStructures, document);
        // 検索結果をプロバイダーに通知
        provider.refresh(organizedResults);
    }
    catch (error) {
        console.error("Error in findOccurrencesInStructure:", error);
        vscode_1.default.window.showErrorMessage(`Error finding occurrences: ${error}`);
    }
}
// クリア機能を実装する関数
function clearSearch(rangeNavigatorProvider, editor) {
    // 最後に検索したテキストをクリア
    lastSearchedText = '';
    // コンテキスト変数を更新
    updateSearchContext(false);
    // エディタがある場合はハイライトをクリア
    if (editor) {
        clearHighlights(editor);
    }
    // ウェルカムメッセージを表示
    rangeNavigatorProvider.showWelcomeMessage();
    // 通知を表示
    vscode_1.default.window.showInformationMessage(vscode_1.l10n.t('Search cleared'));
}
function deactivate() {
    if (highlightDecorationType) {
        highlightDecorationType.dispose();
    }
}
//# sourceMappingURL=extension.js.map