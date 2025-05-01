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
// 検索履歴を保持する配列を変更
let searchHistory = [];
// 検索履歴表示モードかどうかのフラグ
let isSearchHistoryMode = false;
// 現在のハイライト範囲を記録するグローバル変数と、そのハイライトのテキスト内容を保存
let currentHighlightRange = null;
let currentHighlightLineContent = null;
// 選択中のアイテムを保持するグローバル変数
let selectedOccurrence = null;
// グローバル変数としてデコレーションタイプを追加
let selectionHighlightDecorationType;
// スクロールバーハイライト用のデコレーションタイプをグローバル変数として追加
let scrollbarHighlightDecorationType;
// サポートされている拡張子の定義
// 構造化表示対象の拡張子
const STRUCTURED_VIEW_EXTENSIONS = {
    // JavaScript/TypeScript
    jsFamily: ['js', 'jsx', 'ts', 'tsx'],
    // Java
    javaFamily: ['java']
};
// すべてのサポート拡張子を一つの配列に展開
const SUPPORTED_EXTENSIONS = [
    ...STRUCTURED_VIEW_EXTENSIONS.jsFamily,
    ...STRUCTURED_VIEW_EXTENSIONS.javaFamily
];
// 履歴用のクラス
class HistoryItem {
    searchText;
    occurrenceInfo;
    constructor(searchText, occurrenceInfo) {
        this.searchText = searchText;
        this.occurrenceInfo = occurrenceInfo;
    }
}
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
// 検索履歴の表示用ノード
class SearchHistoryNode extends TreeNode {
    constructor() {
        const historyTitle = vscode_1.l10n.t('Line Search History');
        super(historyTitle, vscode_1.default.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode_1.default.ThemeIcon("history");
        this.tooltip = vscode_1.l10n.t('View and reuse past searches');
        this.contextValue = 'searchHistoryRoot';
    }
}
// 個々の検索履歴項目
class SearchHistoryItemNode extends TreeNode {
    historyItem;
    _isSelected = false;
    constructor(historyItem) {
        // 通常モードと同じ表示形式にする
        const lineNumber = historyItem.occurrenceInfo.lineNumber + 1;
        const lineText = historyItem.occurrenceInfo.lineText;
        const searchText = historyItem.searchText;
        // 行のテキスト全体を表示するよう修正
        // 検索キーワードの前後のコンテキストを計算
        const startIndex = lineText.indexOf(searchText);
        const contextBefore = 20;
        const contextAfter = 30;
        const startPos = Math.max(0, startIndex - contextBefore);
        const textBefore = lineText.substring(startPos, startIndex);
        const highlightedText = searchText;
        const textAfter = lineText.substring(startIndex + searchText.length, Math.min(lineText.length, startIndex + searchText.length + contextAfter)
        // Ensure this is part of a valid function call or statement
        ); // Example: Add this to a valid function or remove if unnecessary
        // 行番号プレフィックス
        const linePrefix = vscode_1.l10n.t('Line {0}: ', lineNumber);
        // 完全なテキストを構築
        const fullText = `${linePrefix}${textBefore}${highlightedText}${textAfter}`;
        // ハイライト位置を計算
        const prefixLength = linePrefix.length;
        const highlightStart = prefixLength + textBefore.length;
        const highlightEnd = highlightStart + highlightedText.length;
        // TreeItemLabel としてラベルを設定
        const label = {
            label: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
        super(label, vscode_1.default.TreeItemCollapsibleState.None);
        this.historyItem = historyItem;
        this.updateIcon();
        this.tooltip = lineText.trim();
        this.contextValue = 'searchHistoryItem';
        // クリックで行にジャンプするコマンドを設定
        this.command = {
            title: "Go to Line",
            command: "rangeNavigator.gotoHistoryLine",
            arguments: [historyItem, this]
        };
    }
    // 選択状態を設定するメソッド
    set isSelected(value) {
        this._isSelected = value;
        this.updateIcon();
        // ラベルの更新方法も変更する必要がある（マーカーを追加するため）
        this.updateLabel();
    }
    // 選択状態を取得するメソッド
    get isSelected() {
        return this._isSelected;
    }
    // アイコンを更新するメソッド
    updateIcon() {
        // 検索履歴モードではチェックマークアイコンを表示せず、常に検索アイコンを表示
        if (isSearchHistoryMode) {
            this.iconPath = new vscode_1.default.ThemeIcon("search");
        }
        else {
            // 通常モードでは選択状態に応じてアイコンを変更
            if (this._isSelected) {
                this.iconPath = new vscode_1.default.ThemeIcon("check", new vscode_1.default.ThemeColor("terminal.ansiGreen"));
            }
            else {
                this.iconPath = new vscode_1.default.ThemeIcon("search");
            }
        }
    }
    // ラベルを更新するメソッド - TextOccurrence クラスと同様の処理にする
    updateLabel() {
        // ラベルがオブジェクトの場合の処理
        if (typeof this.label === 'object' && this.label.label) {
            const currentLabel = this.label.label;
            const highlights = this.label.highlights || [];
            // 検索履歴モードでは選択マーカーを表示しない
            if (isSearchHistoryMode) {
                // 既にマーカーがある場合は削除する
                const hasMarker = currentLabel.startsWith('➤ ');
                if (hasMarker) {
                    const baseLabel = currentLabel.substring(2);
                    this.label = {
                        label: baseLabel,
                        highlights: highlights.map(([start, end]) => [start - 2, end - 2])
                    };
                }
                // 検索履歴モードでは新しいマーカーは追加しない
            }
            else {
                // 通常モード - 元の処理をそのまま実行
                // 選択マーカーを追加またはクリア
                const hasMarker = currentLabel.startsWith('➤ ');
                const baseLabel = hasMarker ? currentLabel.substring(2) : currentLabel;
                if (this._isSelected && !hasMarker) {
                    // マーカーを追加して、ハイライト位置を調整
                    this.label = {
                        label: `➤ ${baseLabel}`,
                        highlights: highlights.map(([start, end]) => [start + 2, end + 2])
                    };
                }
                else if (!this._isSelected && hasMarker) {
                    // マーカーを削除して、ハイライト位置を調整
                    this.label = {
                        label: baseLabel,
                        highlights: highlights.map(([start, end]) => [start - 2, end - 2])
                    };
                }
            }
        }
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
        // 検索機能に関する説明
        const searchFeaturesNode = new TreeNode(vscode_1.l10n.t('Search Features:'), vscode_1.default.TreeItemCollapsibleState.Expanded);
        searchFeaturesNode.iconPath = new vscode_1.default.ThemeIcon('search');
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('1. Select text in the editor'), 'selection'));
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('2. All exact matches will be shown here'), 'list-tree'));
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('3. Click on an item to navigate to it'), 'go-to-file'));
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('4. Selected occurrences are highlighted'), 'symbol-color'));
        // 履歴機能に関する説明
        const historyFeaturesNode = new TreeNode(vscode_1.l10n.t('History Features:'), vscode_1.default.TreeItemCollapsibleState.Expanded);
        historyFeaturesNode.iconPath = new vscode_1.default.ThemeIcon('history');
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('1. Selections you navigate to are saved in history'), 'bookmark'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('2. Click the history icon to view past selections'), 'clock'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('3. History entries show the line content and position'), 'list-ordered'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('4. Click a history item to return to that location'), 'arrow-right'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('5. Line selection history is preserved between sessions'), 'save'));
        // メインノードに追加
        this.addChild(searchFeaturesNode);
        this.addChild(historyFeaturesNode);
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
        // ラベルをカスタマイズしない（後で更新する）
        super(name, collapsibleState);
        this.name = name;
        this.type = type;
        this.range = range;
        this.document = document;
        // アイコンの設定（既存のコードと同じ）
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
    }
    // 子ノードが追加された後にラベルを更新するメソッドを追加
    updateLabelWithCount() {
        // 子ノードの数を取得（検索結果の件数）
        const count = this.children.length;
        // 件数を表示するラベルを作成
        let label = vscode_1.l10n.t('{0} ({1})', this.name, count);
        // ラベルを更新
        this.label = label;
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
    // 初期値を設定して型エラーを解消
    highlightInfo = {
        fullText: "",
        highlights: [[0, 0]]
    };
    _isSelected = false;
    textBefore = "";
    highlightedText = "";
    textAfter = "";
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
        this.textBefore = lineText.substring(startPos, startIndex);
        this.highlightedText = lineText.substring(startIndex, startIndex + searchText.length);
        this.textAfter = lineText.substring(startIndex + searchText.length, Math.min(lineText.length, startIndex + searchText.length + contextAfter));
        // 表示テキストを更新
        this.updateLabel();
        // 通常のアイコンを設定
        this.iconPath = new vscode_1.default.ThemeIcon("list-selection", new vscode_1.default.ThemeColor("terminal.ansiBlue"));
        this.tooltip = lineText.trim();
        // コマンドが指定されていなければデフォルトコマンドを設定
        if (!command) {
            this.command = {
                title: "Go to Occurrence",
                command: "rangeNavigator.gotoOccurrence",
                arguments: [document.uri, position, this.lineRange, searchText.length, this],
            };
        }
        else {
            this.command = command;
        }
    }
    // 選択状態を設定するメソッド
    set isSelected(value) {
        this._isSelected = value;
        // 選択状態に応じてアイコンを変更
        if (this._isSelected) {
            this.iconPath = new vscode_1.default.ThemeIcon("check", new vscode_1.default.ThemeColor("terminal.ansiGreen"));
        }
        else {
            this.iconPath = new vscode_1.default.ThemeIcon("list-selection", new vscode_1.default.ThemeColor("terminal.ansiBlue"));
        }
        // ラベルを更新
        this.updateLabel();
    }
    // 選択状態を取得するメソッド
    get isSelected() {
        return this._isSelected;
    }
    // ラベルを更新するメソッド
    updateLabel() {
        // 行番号プレフィックス
        let linePrefix = vscode_1.l10n.t('Line {0}: ', this.lineNumber + 1);
        // 選択中の場合、特別なマーカーを追加
        const marker = this._isSelected ? '➤ ' : '';
        const fullText = `${marker}${linePrefix}${this.textBefore}${this.highlightedText}${this.textAfter}`;
        // ハイライト位置を調整（マーカーの有無によって調整）
        const markerLength = this._isSelected ? 2 : 0;
        const prefixLength = linePrefix.length;
        const highlightStart = markerLength + prefixLength + this.textBefore.length;
        const highlightEnd = highlightStart + this.highlightedText.length;
        // ハイライト情報を更新（この変数を使用しない場合は削除してもよい）
        this.highlightInfo = {
            fullText: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
        // ラベルを設定
        this.label = {
            label: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };
    }
}
class RangeNavigatorProvider {
    context;
    _onDidChangeTreeData = new vscode_1.default.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    rootNodes = [];
    searchHistoryNode = null;
    constructor(context) {
        this.context = context;
        // 初期表示用のウェルカムメッセージを設定
        this.showWelcomeMessage();
    }
    // 特定のノードを更新するメソッド
    refreshNode(node) {
        this._onDidChangeTreeData.fire(node);
    }
    // このメソッドは必須 - TreeDataProvider インターフェースで要求される
    getTreeItem(element) {
        return element;
    }
    // このメソッドも必須 - TreeDataProvider インターフェースで要求される
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.rootNodes);
        }
        return Promise.resolve(element.children);
    }
    // オプションだが実装すると便利
    getParent(element) {
        return element.parentNode;
    }
    // 検索履歴を保存するためのメソッド
    saveSearchHistory() {
        // 保存用の単純な形式に変換
        const simpleHistory = searchHistory.map(item => ({
            searchText: item.searchText,
            documentUri: item.occurrenceInfo.documentUri.toString(),
            lineNumber: item.occurrenceInfo.lineNumber,
            lineText: item.occurrenceInfo.lineText,
            character: item.occurrenceInfo.position.character,
            searchTextLength: item.occurrenceInfo.searchTextLength
        }));
        this.context.globalState.update('searchHistory', simpleHistory);
    }
    // ウェルカムメッセージを表示
    showWelcomeMessage() {
        // ウェルカムメッセージのルートノードを作成
        const welcomeNode = new WelcomeMessageNode();
        const usageNode = new UsageInfoNode();
        // 検索履歴ノードを初期化するが、通常モードでは表示しない
        this.searchHistoryNode = new SearchHistoryNode();
        this.updateSearchHistoryNode();
        // 検索履歴モードの場合のみ表示、通常モードでは追加しない
        if (isSearchHistoryMode) {
            this.rootNodes = [this.searchHistoryNode];
        }
        else {
            this.rootNodes = [welcomeNode, usageNode];
        }
        this._onDidChangeTreeData.fire();
        // ウェルカムメッセージを表示済みとしてマーク
        hasShownWelcomeMessage = true;
    }
    // 検索履歴ノードを更新する
    updateSearchHistoryNode() {
        if (!this.searchHistoryNode) {
            this.searchHistoryNode = new SearchHistoryNode();
        }
        // 既存の子ノードをクリア
        this.searchHistoryNode.children = [];
        // 検索履歴から子ノードを追加
        for (const item of searchHistory) {
            const historyItem = new SearchHistoryItemNode(item);
            this.searchHistoryNode.addChild(historyItem);
        }
    }
    refresh(rootNodes) {
        // 検索履歴モードの場合
        if (isSearchHistoryMode) {
            // 検索履歴モードでは、rootNodesをそのまま使用
            this.rootNodes = rootNodes;
        }
        else {
            // 通常モードでは検索履歴ノードを追加しない
            this.rootNodes = rootNodes;
        }
        this._onDidChangeTreeData.fire();
    }
}
// コードの構造（クラス、関数など）を解析する機能
async function parseCodeStructure(document) {
    const structures = [];
    const text = document.getText();
    // ファイル拡張子を取得して言語を特定
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';
    // 様々な言語のクラス定義に対応するパターン
    const classPattern = /\b(?:class|struct|interface|trait|enum|record)\s+(\w+)(?:\s+(?:extends|implements|:|<|inherits|with)\s+[\w\s,<>]+)?/g;
    // 様々な言語の関数定義に対応するパターン
    const functionPattern = /\b(?:function|func|fn|def|sub|procedure|proc|method|fun|public|private|protected|static|async)\s+(\w+)\s*\([^)]*\)/g;
    // 様々な言語のメソッド定義に対応するパターン
    const methodPattern = /(?:\b(?:public|private|protected|internal|final|override|virtual|static|async)(?:\s+|\s+\w+\s+))?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\],\s]+\s*)?(?:{\s*|=>|throws|is|as|->)/g;
    // クラスを検索
    let match;
    while ((match = classPattern.exec(text)) !== null) {
        const className = match[1];
        const startPos = document.positionAt(match.index);
        // クラスの終了位置を特定（言語によって異なる可能性がある）
        let classEndIndex;
        // 括弧ベースの言語（Java, C#, JavaScript など）
        classEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
        const endPos = classEndIndex !== -1 ?
            document.positionAt(classEndIndex) :
            document.positionAt(text.length);
        const range = new vscode_1.default.Range(startPos, endPos);
        const classNode = new CodeStructureNode(className, 'class', range, document);
        structures.push(classNode);
        // クラス本体のテキストを抽出して解析
        const classBodyText = text.substring(document.offsetAt(startPos), document.offsetAt(endPos));
        // メソッドをクラス内で検索
        const methodRegex = new RegExp(methodPattern);
        let methodMatch;
        // クラス本体内でのオフセットを計算するための基準値
        const classBodyOffset = document.offsetAt(startPos);
        while ((methodMatch = methodRegex.exec(classBodyText)) !== null) {
            const methodName = methodMatch[1];
            // メソッド名がconstructorでない場合のみ処理（コンストラクタは特別扱い）
            // 各言語固有のコンストラクタ名をチェック
            const constructorNames = ['constructor', '__construct', 'New', 'init'];
            if (!constructorNames.includes(methodName)) {
                // クラス内でのメソッドの位置を計算
                const methodStartOffset = classBodyOffset + methodMatch.index;
                const methodStartPos = document.positionAt(methodStartOffset);
                // メソッドの終了位置を特定
                const methodEndIndex = findMatchingBrace(text, methodStartOffset);
                const methodEndPos = methodEndIndex !== -1 ?
                    document.positionAt(methodEndIndex) :
                    document.positionAt(text.length);
                const methodRange = new vscode_1.default.Range(methodStartPos, methodEndPos);
                const methodNode = new CodeStructureNode(methodName, 'method', methodRange, document);
                // メソッドをクラスの子ノードとして追加
                classNode.addChild(methodNode);
            }
        }
    }
    // 独立した関数を検索（クラス外の関数）
    while ((match = functionPattern.exec(text)) !== null) {
        const functionName = match[1];
        const startPos = document.positionAt(match.index);
        // 関数がクラス内にあるかチェック
        let isInsideClass = false;
        for (const structure of structures) {
            if (structure.type === 'class' && structure.range.contains(startPos)) {
                isInsideClass = true;
                break;
            }
        }
        // クラス内の関数は既にメソッドとして処理されているためスキップ
        if (isInsideClass) {
            continue;
        }
        const funcEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
        const endPos = funcEndIndex !== -1 ?
            document.positionAt(funcEndIndex) :
            document.positionAt(text.length);
        const range = new vscode_1.default.Range(startPos, endPos);
        structures.push(new CodeStructureNode(functionName, 'function', range, document));
    }
    return structures;
}
// 対応する閉じ括弧を見つける簡易的な関数
function findMatchingBrace(text, startOffset) {
    // 開始括弧を見つける
    let openBracePos = -1;
    for (let i = startOffset; i < text.length; i++) {
        if (text[i] === '{') {
            openBracePos = i;
            break;
        }
        else if (text[i] === ';') {
            // セミコロンで終わる言語（特に宣言のみの場合）はここで終了
            return i + 1;
        }
    }
    // 開始括弧が見つからなかった場合
    if (openBracePos === -1) {
        return -1;
    }
    // 対応する閉じ括弧を探す
    let braceCount = 1;
    for (let i = openBracePos + 1; i < text.length; i++) {
        const char = text[i];
        if (char === '{') {
            braceCount++;
        }
        else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                return i + 1; // 閉じ括弧の次の位置
            }
        }
    }
    return -1; // 対応する閉じ括弧が見つからない
}
// 親ノードを探して子ノードを追加するヘルパー関数
function addToParentIfFound(node, parentName, childNode) {
    if (node.name === parentName) {
        node.addChild(childNode);
        return true;
    }
    for (const child of node.children) {
        if (child instanceof CodeStructureNode) {
            if (addToParentIfFound(child, parentName, childNode)) {
                return true;
            }
        }
    }
    return false;
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
    // ファイル拡張子を取得
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';
    // 各出現箇所に関連付け情報を追加
    for (const occurrence of occurrences) {
        const position = occurrence.position;
        let matched = false;
        // 現在の行のテキストを取得
        const lineText = document.lineAt(position.line).text;
        // 出現箇所が属する最も詳細な構造を見つけるループ
        for (let i = 0; i < rootNodes.length; i++) {
            const node = rootNodes[i];
            // CodeStructureNodeの場合のみチェック
            if (node instanceof CodeStructureNode) {
                // 位置が構造の範囲内かチェック
                if (node.range.contains(position)) {
                    // クラス内のメソッドをチェック
                    let methodMatched = false;
                    if (node.type === 'class') {
                        for (let j = 0; j < node.children.length; j++) {
                            const childNode = node.children[j];
                            if (childNode instanceof CodeStructureNode &&
                                childNode.type === 'method' &&
                                childNode.range.contains(position)) {
                                childNode.addChild(occurrence);
                                methodMatched = true;
                                matched = true;
                                break;
                            }
                        }
                    }
                    // メソッド内で見つからなかった場合はクラスまたは関数直下に追加
                    if (!methodMatched) {
                        node.addChild(occurrence);
                        matched = true;
                    }
                    break;
                }
            }
        }
        // どの構造にも属さない場合は「その他」に分類
        if (!matched) {
            uncategorizedNode.addChild(occurrence);
            hasUncategorized = true;
        }
    }
    // 検索結果を持たない構造を削除（階層的に処理）
    // 1. まずメソッドレベルで検索結果がないものを削除
    for (const rootNode of rootNodes) {
        // 検索結果を含むメソッドだけを残す
        rootNode.children = rootNode.children.filter(child => {
            if (child instanceof CodeStructureNode) {
                return child.children.length > 0;
            }
            return true; // 検索結果自体は常に残す
        });
    }
    // 2. 次にクラス/関数レベルで検索結果がないものを削除
    const filteredRootNodes = rootNodes.filter(node => {
        // 直接の検索結果または有効な子ノードがある場合のみ残す
        return node.children.length > 0;
    });
    // 検索件数をラベルに反映
    for (const node of filteredRootNodes) {
        if (node instanceof CodeStructureNode) {
            node.updateLabelWithCount();
            // 子ノードの件数も更新
            for (const childNode of node.children) {
                if (childNode instanceof CodeStructureNode) {
                    childNode.updateLabelWithCount();
                }
            }
        }
    }
    // 未分類の出現箇所があれば追加
    if (hasUncategorized) {
        // 未分類ノードのラベルを更新
        uncategorizedNode.label = vscode_1.l10n.t('📍 Other Occurrences ({0})', uncategorizedNode.children.length);
        filteredRootNodes.push(uncategorizedNode);
    }
    return filteredRootNodes;
}
function activate(context) {
    console.log("Activating Range Navigator extension");
    // 設定から色情報を取得
    const config = vscode_1.default.workspace.getConfiguration('rangeNavigator');
    const backgroundColor = config.get('highlight.backgroundColor', 'rgba(255, 165, 0, 0.3)');
    const borderColor = config.get('highlight.borderColor', 'rgba(255, 140, 0, 0.8)');
    const scrollbarColor = config.get('highlight.scrollbarColor', 'rgba(255, 165, 0, 0.7)');
    // 既存の行ハイライト用のデコレーションタイプ
    highlightDecorationType = vscode_1.default.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        border: '1px solid',
        borderColor: borderColor,
        isWholeLine: true,
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode_1.default.OverviewRulerLane.Full
    });
    // 範囲選択用のデコレーションタイプを追加
    selectionHighlightDecorationType = vscode_1.default.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        border: '1px solid',
        borderColor: borderColor,
        isWholeLine: false, // 選択範囲のみをハイライト
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode_1.default.OverviewRulerLane.Full
    });
    // 拡張機能のコンテキストから検索履歴を読み込む
    const savedHistory = context.globalState.get('searchHistory', []);
    try {
        // 型が配列の場合のみ処理
        if (Array.isArray(savedHistory)) {
            // 保存された履歴を復元
            searchHistory = savedHistory.map(item => {
                if (item && typeof item === 'object' && 'documentUri' in item) {
                    // 新しいフォーマットの場合
                    const position = new vscode_1.default.Position(item.lineNumber, item.character);
                    const occurrenceInfo = {
                        documentUri: vscode_1.default.Uri.parse(item.documentUri),
                        lineNumber: item.lineNumber,
                        lineText: item.lineText || '',
                        position: position,
                        searchText: item.searchText,
                        searchTextLength: item.searchTextLength || item.searchText.length
                    };
                    return new HistoryItem(item.searchText, occurrenceInfo);
                }
                // 変換できないアイテムはスキップ
                return null;
            }).filter(item => item !== null);
        }
        else {
            // 配列でない場合は空の配列で初期化
            searchHistory = [];
        }
    }
    catch (error) {
        console.error("Error loading search history:", error);
        // エラーが発生した場合は空の配列で初期化
        searchHistory = [];
    }
    // 以下は既存のコード
    // コンテキスト変数を初期化
    updateSearchContext(false);
    // 設定が変更された場合にウィンドウをリロードするためのイベントリスナーを登録
    context.subscriptions.push(vscode_1.default.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('rangeNavigator.highlight.backgroundColor')
            || e.affectsConfiguration('rangeNavigator.highlight.borderColor')
            || e.affectsConfiguration('rangeNavigator.highlight.scrollbarColor')
            || e.affectsConfiguration('rangeNavigator.history.maxSize')
            || e.affectsConfiguration('rangeNavigator.autoShowSidebarOnSearch')) {
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
        isWholeLine: true,
        // スクロールバーに表示するための設定を追加
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode_1.default.OverviewRulerLane.Center
    });
    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    const treeView = vscode_1.default.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: false,
    });
    // 履歴から行に移動するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('rangeNavigator.gotoHistoryLine', async (historyItem, historyItemNode) => {
        const docUri = historyItem.occurrenceInfo.documentUri;
        const position = historyItem.occurrenceInfo.position;
        const lineNumber = historyItem.occurrenceInfo.lineNumber;
        const searchText = historyItem.searchText;
        const searchTextLength = historyItem.occurrenceInfo.searchTextLength;
        // 検索履歴から該当項目を削除して先頭に追加することで最新の履歴にする
        const historyIndex = searchHistory.findIndex(item => item.occurrenceInfo.documentUri.toString() === docUri.toString() &&
            item.occurrenceInfo.lineNumber === lineNumber &&
            item.searchText === searchText);
        if (historyIndex !== -1) {
            // 該当項目を配列から取り出す
            const selectedItem = searchHistory.splice(historyIndex, 1)[0];
            // 配列の先頭に追加する
            searchHistory.unshift(selectedItem);
            // グローバルステートを更新
            rangeNavigatorProvider.saveSearchHistory();
            // 検索履歴ノードを更新
            rangeNavigatorProvider.updateSearchHistoryNode();
        }
        // 以下は既存の処理
        // 検索履歴モードの場合は通常モードに切り替える
        if (isSearchHistoryMode) {
            isSearchHistoryMode = false;
            vscode_1.default.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);
        }
        // サイドバーからのナビゲーションフラグを設定
        isNavigatingFromSidebar = true;
        try {
            // ドキュメントを開く
            const editor = await vscode_1.default.window.showTextDocument(docUri);
            const document = editor.document;
            // 行番号が有効かチェック
            if (lineNumber >= 0 && lineNumber < document.lineCount) {
                // 行の現在のテキストを取得
                const currentLineText = document.lineAt(lineNumber).text;
                // 検索テキストが現在の行に含まれているか確認
                if (currentLineText.includes(searchText)) {
                    // 検索テキストの現在の位置を探す
                    const currentIndex = currentLineText.indexOf(searchText);
                    const currentPosition = new vscode_1.default.Position(lineNumber, currentIndex);
                    const selectionEnd = new vscode_1.default.Position(lineNumber, currentIndex + searchTextLength);
                    // 検索テキストを選択
                    editor.selection = new vscode_1.default.Selection(currentPosition, selectionEnd);
                    // 見やすいようにスクロール位置を調整
                    editor.revealRange(new vscode_1.default.Range(currentPosition, selectionEnd), vscode_1.default.TextEditorRevealType.InCenter);
                    // 行ハイライトを適用
                    const lineRange = new vscode_1.default.Range(lineNumber, 0, lineNumber, currentLineText.length);
                    setTimeout(() => {
                        // ハイライト表示を維持
                        highlightSelectedLine(editor, lineRange);
                        // 最後に検索したテキストを更新して通常モードで検索結果を表示
                        lastSearchedText = searchText;
                        // 操作完了後に通常モードで検索結果を表示し、選択状態を維持
                        findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider)
                            .then(() => {
                            // 検索結果が表示された後、該当行を選択状態にする
                            setTimeout(() => {
                                // 行に対応するTextOccurrenceを見つけて選択状態にする処理
                                updateOccurrenceSelection(rangeNavigatorProvider, lineNumber, currentIndex, searchText);
                                // フラグをリセット
                                isNavigatingFromSidebar = false;
                            }, 300);
                        });
                    }, 100);
                }
                else {
                    // 検索テキストが行にない場合はカーソル位置だけ移動
                    const linePosition = new vscode_1.default.Position(lineNumber, 0);
                    editor.selection = new vscode_1.default.Selection(linePosition, linePosition);
                    // 見やすいようにスクロール位置を調整
                    editor.revealRange(new vscode_1.default.Range(linePosition, linePosition), vscode_1.default.TextEditorRevealType.InCenter);
                    // ハイライトは行わないが、最後に検索したテキストを更新
                    lastSearchedText = searchText;
                    // 通常モードで検索結果を表示
                    findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider);
                    // 操作完了後にフラグをリセット
                    setTimeout(() => {
                        isNavigatingFromSidebar = false;
                    }, 300);
                    // 検索テキストが見つからない旨をメッセージ表示
                    vscode_1.default.window.showInformationMessage(vscode_1.l10n.t('The search text {0} is not found in the current line.', searchText));
                }
            }
            else {
                // 無効な行番号の場合
                vscode_1.default.window.showWarningMessage(vscode_1.l10n.t('The specified line number {0} is outside the document range.', lineNumber + 1));
                isNavigatingFromSidebar = false;
            }
        }
        catch (error) {
            console.error("Error navigating to history line:", error);
            vscode_1.default.window.showErrorMessage(vscode_1.l10n.t('Error navigating to history line.'));
            isNavigatingFromSidebar = false;
        }
    }));
    // 検索履歴を表示するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('range-navigator.showSearchHistory', () => {
        // 検索履歴モードでない場合（通常モードの場合）は、履歴を表示する
        if (!isSearchHistoryMode) {
            // 現在の選択状態を保存（モード切替前に保存することが重要）
            const currentSelection = selectedOccurrence;
            // 履歴モードに切り替え
            isSearchHistoryMode = true;
            vscode_1.default.commands.executeCommand('setContext', 'rangeNavigator.historyMode', true);
            // 履歴モードに切り替える際は一時的に選択状態を解除するが、変数自体は保持
            if (selectedOccurrence) {
                // 選択状態を視覚的に解除するだけ
                selectedOccurrence.isSelected = false;
                rangeNavigatorProvider.refreshNode(selectedOccurrence);
                // ここで selectedOccurrence 自体は null にしない
            }
            // 検索履歴のみを表示
            showSearchHistoryOnly(rangeNavigatorProvider);
        }
        else {
            // 通常モードに切り替え
            isSearchHistoryMode = false;
            vscode_1.default.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);
            // 通常モードに戻す
            if (lastSearchedText) {
                const editor = vscode_1.default.window.activeTextEditor;
                if (editor) {
                    // 最後の検索テキストを使用して検索結果を表示
                    findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
                }
            }
            else {
                // 検索テキストがない場合はウェルカムメッセージを表示
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }
    }));
    // 履歴から再検索するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('rangeNavigator.searchAgain', async (searchText) => {
        const editor = vscode_1.default.window.activeTextEditor;
        if (!editor) {
            return vscode_1.default.window.showWarningMessage(vscode_1.l10n.t('No active editor found.'));
        }
        // 検索履歴モードを解除
        isSearchHistoryMode = false;
        vscode_1.default.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);
        // 選択テキストを設定して検索を実行
        lastSearchedText = searchText;
        await findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider);
    }));
    // 履歴をクリアするコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('range-navigator.clearHistory', () => {
        // 履歴をクリア
        searchHistory = [];
        // グローバルステートを更新
        context.globalState.update('searchHistory', searchHistory);
        // 検索履歴ノードを更新
        if (rangeNavigatorProvider instanceof RangeNavigatorProvider) {
            rangeNavigatorProvider.updateSearchHistoryNode();
            // 検索履歴モードの場合
            if (isSearchHistoryMode) {
                // 検索履歴ノードを空の状態で表示
                const emptyHistoryNode = new SearchHistoryNode();
                emptyHistoryNode.collapsibleState = vscode_1.default.TreeItemCollapsibleState.Expanded;
                rangeNavigatorProvider.refresh([emptyHistoryNode]);
                showSearchHistoryOnly(rangeNavigatorProvider);
            }
            else {
                // 通常モードの場合はウェルカムメッセージを表示
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }
        vscode_1.default.window.showInformationMessage(vscode_1.l10n.t('Search history has been cleared.'));
    }));
    // ツリービューを折りたたむコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand("range-navigator.collapseAll", () => {
        vscode_1.default.commands.executeCommand('workbench.actions.treeView.rangeNavigatorView.collapseAll');
    }));
    // ツリービューを展開するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand("range-navigator.expandAll", () => {
        expandAll(treeView, rangeNavigatorProvider);
    }));
    // クリックされた行への移動とハイライト表示を行うコマンド
    vscode_1.default.commands.registerCommand('rangeNavigator.gotoOccurrence', (docUri, position, range, searchTextLength, occurrence) => {
        // 前の選択をクリア
        if (selectedOccurrence && selectedOccurrence !== occurrence) {
            selectedOccurrence.isSelected = false;
            rangeNavigatorProvider.refreshNode(selectedOccurrence);
        }
        // 新しい選択を設定
        selectedOccurrence = occurrence;
        occurrence.isSelected = true;
        rangeNavigatorProvider.refreshNode(occurrence);
        // サイドバーからのナビゲーションフラグを設定
        isNavigatingFromSidebar = true;
        // クリックされた行への移動とハイライト表示を行う
        vscode_1.default.window.showTextDocument(docUri).then(editor => {
            // 検索テキストの範囲全体を選択
            const selectionEnd = new vscode_1.default.Position(position.line, position.character + searchTextLength);
            const selectionRange = new vscode_1.default.Range(position, selectionEnd);
            editor.selection = new vscode_1.default.Selection(position, selectionEnd);
            // 見やすいようにスクロール位置を調整
            editor.revealRange(selectionRange, vscode_1.default.TextEditorRevealType.InCenter);
            // 行全体と選択範囲のハイライトを適用
            setTimeout(() => {
                // 現在の行の最新の範囲を取得
                const currentLine = editor.document.lineAt(position.line);
                const lineRange = new vscode_1.default.Range(position.line, 0, position.line, currentLine.text.length);
                // 行ハイライトを適用
                highlightSelectedLine(editor, lineRange);
                // 選択範囲ハイライトを適用
                highlightSelection(editor, selectionRange);
                // ★追加：スクロールバーに選択行のみをハイライト表示
                highlightSingleOccurrenceInScrollbar(editor, occurrence);
                // 操作完了後にフラグをリセット
                setTimeout(() => {
                    isNavigatingFromSidebar = false;
                }, 300);
            }, 100);
            // クリックされた行を履歴に追加
            const searchText = editor.document.getText(editor.selection);
            if (searchText && searchText.length > 0) {
                // 履歴情報を作成
                const occurrenceInfo = {
                    documentUri: docUri,
                    lineNumber: position.line,
                    lineText: editor.document.lineAt(position.line).text,
                    position: position,
                    searchText: searchText,
                    searchTextLength: searchTextLength
                };
                // 履歴に追加
                addToLineHistory(searchText, occurrenceInfo, rangeNavigatorProvider);
            }
        });
    });
    // 選択テキスト変更イベントハンドラ
    let previousSelection;
    // 選択テキスト変更イベントハンドラ
    const handleSelectionChange = async (editor) => {
        if (!editor) {
            return;
        }
        // 設定から自動サイドバー表示の有効/無効を取得
        const config = vscode_1.default.workspace.getConfiguration('rangeNavigator');
        const autoShowSidebarOnSearch = config.get('autoShowSidebarOnSearch', false);
        const selection = editor.selection;
        // サイドバーからのナビゲーション中は処理をスキップ
        if (isNavigatingFromSidebar) {
            return;
        }
        // 範囲選択の場合
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            if (selectedText && selectedText.length > 0) {
                console.log(`Selected text: "${selectedText}"`);
                lastSearchedText = selectedText; // 最後に検索したテキストを保存
                // 自動サイドバー表示設定が有効な場合
                if (autoShowSidebarOnSearch) {
                    // サイドバーが表示されていない場合は表示する
                    if (!treeView.visible) {
                        await vscode_1.default.commands.executeCommand('rangeNavigatorView.focus');
                    }
                    // 選択されたテキストを検索
                    await findOccurrencesInStructure(editor, selectedText, rangeNavigatorProvider);
                }
                else if (treeView.visible) {
                    // 従来の動作：サイドバーが表示されている場合のみ検索を実行
                    await findOccurrencesInStructure(editor, selectedText, rangeNavigatorProvider);
                }
            }
        }
        else {
            // カーソル位置の変更だけの場合（範囲選択なし）
            // 選択範囲ハイライトはクリアするが、行ハイライトは保持
            editor.setDecorations(selectionHighlightDecorationType, []);
            if (lastSearchedText) {
                // 何もしない - 行ハイライトと検索結果はそのまま表示
            }
            else {
                // 検索結果がない場合はウェルカムメッセージを表示
                clearHighlights(editor);
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }
        // 現在の選択状態を保存
        previousSelection = selection;
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
        // 検索とハイライトをクリア
        clearSearch(rangeNavigatorProvider, editor);
        // サイドバーが表示されている場合、ウェルカムメッセージを表示
        if (treeView.visible) {
            rangeNavigatorProvider.showWelcomeMessage();
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
        if (!editor || event.document !== editor.document) {
            return;
        }
        // ハイライトが存在する場合の処理
        if (currentHighlightRange !== null && currentHighlightLineContent !== null) {
            const document = editor.document;
            const originalLine = currentHighlightRange.start.line;
            // ドキュメント全体をスキャンして、ハイライト行を探す
            let foundLine = -1;
            // まず元の行を確認
            if (originalLine < document.lineCount) {
                const lineText = document.lineAt(originalLine).text;
                // 元の行のテキストが一致していれば、ハイライト位置を維持
                if (lineText === currentHighlightLineContent) {
                    foundLine = originalLine;
                }
            }
            // 元の行のテキストが変わっている場合は、周辺行をスキャン
            if (foundLine === -1) {
                // 前後10行程度を調べる（範囲は調整可能）
                const startLine = Math.max(0, originalLine - 10);
                const endLine = Math.min(document.lineCount - 1, originalLine + 10);
                for (let i = startLine; i <= endLine; i++) {
                    if (document.lineAt(i).text === currentHighlightLineContent) {
                        foundLine = i;
                        break;
                    }
                }
            }
            // ハイライト行が見つかった場合は更新、見つからなかった場合はクリア
            if (foundLine !== -1) {
                const updatedRange = new vscode_1.default.Range(foundLine, 0, foundLine, document.lineAt(foundLine).text.length);
                editor.setDecorations(highlightDecorationType, [updatedRange]);
                currentHighlightRange = updatedRange;
                // テキスト内容は変わっていないので更新不要
            }
            else {
                // ハイライト行が見つからない（削除された）場合はクリア
                clearHighlights(editor);
            }
        }
        // 検索結果の更新処理（既存のコード）
        if (treeView.visible && lastSearchedText) {
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
    // ハイライトのみを削除するコマンド
    context.subscriptions.push(vscode_1.default.commands.registerCommand('range-navigator.clearHighlightsOnly', () => {
        const editor = vscode_1.default.window.activeTextEditor;
        if (editor) {
            clearHighlights(editor);
            // 現在のハイライト情報をリセット
            currentHighlightRange = null;
            currentHighlightLineContent = null;
        }
    }));
    // スクロールバーハイライト用のデコレーションタイプを初期化
    scrollbarHighlightDecorationType = vscode_1.default.window.createTextEditorDecorationType({
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode_1.default.OverviewRulerLane.Center
    });
}
// エディタの選択位置からサイドバーの対応項目を選択状態にする関数
function updateSidebarSelectionFromEditor(editor, selection, provider) {
    // 前の選択をクリア
    if (selectedOccurrence) {
        selectedOccurrence.isSelected = false;
        provider.refreshNode(selectedOccurrence);
        selectedOccurrence = null;
    }
    const selectedText = editor.document.getText(selection);
    const selectedLine = selection.start.line;
    const selectedCharacter = selection.start.character;
    // ツリー内のノードを再帰的に探索する関数
    function findMatchingOccurrence(nodes) {
        for (const node of nodes) {
            // TextOccurrenceノードの場合、位置が一致するか確認
            if (node instanceof TextOccurrence) {
                // 行番号と選択テキストが一致し、開始位置が選択範囲内にある場合にマッチとみなす
                if (node.lineNumber === selectedLine &&
                    node.searchText === selectedText &&
                    Math.abs(node.startIndex - selectedCharacter) < node.searchText.length) {
                    return node;
                }
            }
            // 子ノードがある場合は再帰的に探索
            if (node.children && node.children.length > 0) {
                const found = findMatchingOccurrence(node.children);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
    // rootNodesから検索
    const occurrence = findMatchingOccurrence(provider['rootNodes']);
    // 対応するノードが見つかった場合は選択状態に設定
    if (occurrence) {
        selectedOccurrence = occurrence;
        occurrence.isSelected = true;
        provider.refreshNode(occurrence);
        // 可能であればサイドバー内でそのノードを表示するようにスクロール
        try {
            vscode_1.default.commands.executeCommand('rangeNavigatorView.reveal', occurrence, {
                select: true,
                focus: false,
                expand: true
            });
        }
        catch (error) {
            console.log("Error revealing node in tree view:", error);
        }
    }
}
// 単一の出現箇所をスクロールバーにハイライト表示する関数
function highlightSingleOccurrenceInScrollbar(editor, occurrence) {
    // まず既存のスクロールバーハイライトをクリア
    editor.setDecorations(scrollbarHighlightDecorationType, []);
    // 選択された行のみの範囲を作成
    const range = new vscode_1.default.Range(occurrence.lineNumber, occurrence.startIndex, occurrence.lineNumber, occurrence.startIndex + occurrence.searchText.length);
    // スクロールバーに新しいハイライトを適用
    editor.setDecorations(scrollbarHighlightDecorationType, [range]);
    console.log(`Highlighting scrollbar for line ${occurrence.lineNumber + 1}`);
}
// 検索結果から指定の行・位置に一致するTextOccurrenceを選択状態にするヘルパー関数を追加
function updateOccurrenceSelection(provider, lineNumber, startIndex, searchText) {
    // 前の選択をクリア
    if (selectedOccurrence) {
        selectedOccurrence.isSelected = false;
        provider.refreshNode(selectedOccurrence);
        selectedOccurrence = null;
    }
    // ツリー内のノードを再帰的に探索する関数
    function findOccurrenceNode(nodes) {
        for (const node of nodes) {
            // TextOccurrenceノードの場合、位置が一致するか確認
            if (node instanceof TextOccurrence) {
                if (node.lineNumber === lineNumber &&
                    node.startIndex === startIndex &&
                    node.searchText === searchText) {
                    return node;
                }
            }
            // 子ノードがある場合は再帰的に探索
            if (node.children && node.children.length > 0) {
                const found = findOccurrenceNode(node.children);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
    // rootNodesから検索
    const occurrence = findOccurrenceNode(provider['rootNodes']);
    // 対応するノードが見つかった場合は選択状態に設定
    if (occurrence) {
        selectedOccurrence = occurrence;
        occurrence.isSelected = true;
        provider.refreshNode(occurrence);
    }
}
// 履歴ノードを検索するヘルパー関数
function findHistoryNodeByItem(provider, item) {
    // 履歴ノードを取得
    if (!provider.searchHistoryNode) {
        return null;
    }
    // 一致する履歴項目を探す
    for (const node of provider.searchHistoryNode.children) {
        if (node instanceof SearchHistoryItemNode &&
            node.historyItem.searchText === item.searchText &&
            node.historyItem.occurrenceInfo.lineNumber === item.occurrenceInfo.lineNumber &&
            node.historyItem.occurrenceInfo.documentUri.toString() === item.occurrenceInfo.documentUri.toString()) {
            return node;
        }
    }
    return null;
}
// 行履歴を追加する関数
function addToLineHistory(searchText, occurrenceInfo, provider) {
    // 設定から最大履歴数を取得
    const config = vscode_1.default.workspace.getConfiguration('rangeNavigator');
    const maxHistorySize = config.get('history.maxSize', 10);
    // 新しい履歴アイテムを作成
    const newItem = new HistoryItem(searchText, occurrenceInfo);
    // 重複する履歴を探す
    const duplicateIndex = searchHistory.findIndex(item => item.occurrenceInfo.documentUri.toString() === occurrenceInfo.documentUri.toString() &&
        item.occurrenceInfo.lineNumber === occurrenceInfo.lineNumber &&
        item.searchText === searchText);
    // 重複があれば削除
    if (duplicateIndex !== -1) {
        searchHistory.splice(duplicateIndex, 1);
    }
    // 履歴の先頭に追加
    searchHistory.unshift(newItem);
    // 最大数を超えた場合は古いものを削除
    if (searchHistory.length > maxHistorySize) {
        searchHistory = searchHistory.slice(0, maxHistorySize);
    }
    // グローバルステートに保存
    provider.saveSearchHistory();
    // 検索履歴ノードを更新
    provider.updateSearchHistoryNode();
}
// 検索履歴のみを表示する関数
function showSearchHistoryOnly(provider) {
    // 検索履歴ノードのみを表示
    const historyNode = new SearchHistoryNode();
    // 検索履歴がない場合の表示
    if (searchHistory.length === 0) {
        const emptyNode = new TreeNode(vscode_1.l10n.t('No history available.'), vscode_1.default.TreeItemCollapsibleState.None);
        emptyNode.iconPath = new vscode_1.default.ThemeIcon("info");
        historyNode.addChild(emptyNode);
    }
    else {
        // 検索履歴を更新（選択状態を常に非選択に設定）
        for (const item of searchHistory) {
            const historyItem = new SearchHistoryItemNode(item);
            // 明示的に選択状態をfalseに設定する
            historyItem.isSelected = false;
            historyNode.addChild(historyItem);
        }
    }
    // 見出し表示を変更
    historyNode.label = vscode_1.l10n.t('Line Search History');
    // 検索履歴を常に展開表示
    historyNode.collapsibleState = vscode_1.default.TreeItemCollapsibleState.Expanded;
    // ツリービューを更新（検索履歴ノードのみを表示）
    provider.refresh([historyNode]);
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
// 選択範囲をハイライトする関数
function highlightSelection(editor, range) {
    // 既存のハイライトを保持したまま、選択範囲のハイライトを適用
    editor.setDecorations(selectionHighlightDecorationType, [range]);
    console.log(`Highlighting selection from line ${range.start.line + 1}:${range.start.character} to line ${range.end.line + 1}:${range.end.character}`);
}
// ハイライトをクリアする関数を拡張
function clearHighlights(editor) {
    // 行ハイライトをクリア
    editor.setDecorations(highlightDecorationType, []);
    // 選択範囲ハイライトもクリア
    editor.setDecorations(selectionHighlightDecorationType, []);
    // スクロールバーハイライトもクリア
    editor.setDecorations(scrollbarHighlightDecorationType, []);
    // ハイライト情報をリセット
    currentHighlightRange = null;
    currentHighlightLineContent = null;
}
// 指定された行をハイライトする関数
function highlightSelectedLine(editor, range) {
    clearHighlights(editor);
    editor.setDecorations(highlightDecorationType, [range]);
    // 現在のハイライト範囲とその行の内容を保存
    currentHighlightRange = range;
    currentHighlightLineContent = editor.document.lineAt(range.start.line).text;
}
// 指定されたテキストの出現箇所をすべて検索し、コード構造と関連付ける
function updateSearchContext(hasSearchText) {
    vscode_1.default.commands.executeCommand('setContext', 'lastSearchedText', hasSearchText);
}
// findOccurrencesInStructure関数の完全版（修正あり）
async function findOccurrencesInStructure(editor, searchText, provider, prevSelection = null) {
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
        // 完全一致検索のための正規表現パターンを作成
        const searchRegex = new RegExp("\\b" + escapedText + "\\b", "g");
        // ドキュメント内の各行を検索
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            // 行が検索パターンにマッチするかをテスト
            if (!searchRegex.test(lineText)) {
                continue;
            }
            // 正規表現の lastIndex をリセット
            searchRegex.lastIndex = 0;
            let match;
            while ((match = searchRegex.exec(lineText)) !== null) {
                const startPos = new vscode_1.default.Position(i, match.index);
                results.push(new TextOccurrence(searchText, lineText, i, match.index, startPos, document));
            }
        }
        // 検索結果が0件の場合
        if (results.length === 0) {
            // ハイライトをクリア
            clearHighlights(editor);
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
        // 検索結果がある場合のみ、ハイライトを適用
        if (results.length > 0) {
            // 現在の選択範囲に対応する行全体のハイライトを適用
            const selection = editor.selection;
            const lineRange = new vscode_1.default.Range(selection.start.line, 0, selection.end.line, editor.document.lineAt(selection.end.line).text.length);
            highlightSelectedLine(editor, lineRange);
            // 選択範囲のハイライトを追加
            highlightSelection(editor, selection);
        }
        // エディタの選択位置から対応するサイドバー項目を更新
        if (editor.selection && !editor.selection.isEmpty) {
            setTimeout(() => {
                updateSidebarSelectionFromEditor(editor, editor.selection, provider);
            }, 200);
        }
        // グローバルステートに保存（アクセサーメソッドを使用）
        provider.saveSearchHistory();
        // 検索履歴ノードを更新
        provider.updateSearchHistoryNode();
        // ファイル拡張子を取得
        const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';
        // サポートされている拡張子かどうかをチェック
        const isStructuredView = SUPPORTED_EXTENSIONS.includes(fileExtension);
        if (isStructuredView) {
            // サポートされている拡張子の場合のみコード構造を解析
            const codeStructures = await parseCodeStructure(document);
            // 結果をコード構造と関連付ける
            const organizedResults = organizeOccurrencesByStructure(results, codeStructures, document);
            // 以前の選択状態を復元する処理を追加
            if (prevSelection) {
                // 前の選択に一致する新しいノードを探す
                restoreSelection(organizedResults, prevSelection);
            }
            // 検索結果をプロバイダーに通知
            provider.refresh(organizedResults);
        }
        else {
            // サポートされていない拡張子の場合はフラットな結果リストを表示
            // 「検索結果」ルートノードを作成
            const resultRootNode = new TreeNode(vscode_1.l10n.t('Search Results ({0})', results.length), vscode_1.default.TreeItemCollapsibleState.Expanded);
            // 検索結果を追加
            for (const result of results) {
                resultRootNode.addChild(result);
            }
            // 以前の選択状態を復元
            if (prevSelection) {
                restoreSelection([resultRootNode], prevSelection);
            }
            // 検索結果をプロバイダーに通知
            provider.refresh([resultRootNode]);
        }
    }
    catch (error) {
        console.error("Error in findOccurrencesInStructure:", error);
        vscode_1.default.window.showErrorMessage(`Error finding occurrences: ${error}`);
    }
}
// 選択状態を復元するためのヘルパー関数
function restoreSelection(nodes, prevSelection) {
    // prevSelection が null の場合は早期リターン
    if (!prevSelection) {
        return false;
    }
    for (const node of nodes) {
        // TextOccurrence ノードの場合
        if (node instanceof TextOccurrence) {
            if (node.lineNumber === prevSelection.lineNumber &&
                node.startIndex === prevSelection.startIndex) {
                // 選択状態を復元
                node.isSelected = true;
                selectedOccurrence = node;
                return true;
            }
        }
        // 子ノードに対して再帰的に処理
        if (node.children && node.children.length > 0) {
            if (restoreSelection(node.children, prevSelection)) {
                return true;
            }
        }
    }
    return false;
}
// クリア機能を実装する関数
function clearSearch(rangeNavigatorProvider, editor) {
    // 選択状態をリセット
    if (selectedOccurrence) {
        selectedOccurrence.isSelected = false;
        rangeNavigatorProvider.refreshNode(selectedOccurrence);
        selectedOccurrence = null;
    }
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
}
function deactivate() {
    if (highlightDecorationType) {
        highlightDecorationType.dispose();
    }
    if (selectionHighlightDecorationType) {
        selectionHighlightDecorationType.dispose();
    }
    if (scrollbarHighlightDecorationType) {
        scrollbarHighlightDecorationType.dispose();
    }
}
//# sourceMappingURL=extension.js.map