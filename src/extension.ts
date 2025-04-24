import vscode, { l10n } from 'vscode';

// グローバル変数としてデコレーションタイプを宣言
let highlightDecorationType: vscode.TextEditorDecorationType;
// 最後に検索したテキストを保持するグローバル変数
let lastSearchedText: string = '';
// 選択がサイドバーからのものかを判断するフラグ
let isNavigatingFromSidebar: boolean = false;
// 初期表示済みフラグ
let hasShownWelcomeMessage: boolean = false;

// 検索履歴を保持する配列を変更
let searchHistory: HistoryItem[] = [];

// 検索履歴表示モードかどうかのフラグ
let isSearchHistoryMode: boolean = false;

// 現在のハイライト範囲を記録するグローバル変数と、そのハイライトのテキスト内容を保存
let currentHighlightRange: vscode.Range | null = null;
let currentHighlightLineContent: string | null = null;

// 選択中のアイテムを保持するグローバル変数
let selectedOccurrence: TextOccurrence | null = null;

// 主要プログラミング言語の予約語リスト
const RESERVED_KEYWORDS = {
    // JavaScript/TypeScript
    js: [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally',
        'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null',
        'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
        'typeof', 'var', 'void', 'while', 'with', 'await', 'async'
    ],

    // Python
    python: [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
        'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
        'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
        'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
    ],

    // Java
    java: [
        'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
        'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
        'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
        'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package',
        'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
        'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
        'try', 'void', 'volatile', 'while'
    ],

    // C/C++
    c: [
        'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
        'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
        'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
        'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while'
    ],

    // C#
    csharp: [
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
        'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
        'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
        'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
        'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
        'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
        'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
        'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw',
        'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort',
        'using', 'virtual', 'void', 'volatile', 'while'
    ],

    // Ruby
    ruby: [
        'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class',
        'def', 'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'false',
        'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo',
        'rescue', 'retry', 'return', 'self', 'super', 'then', 'true', 'undef',
        'unless', 'until', 'when', 'while', 'yield'
    ],

    // PHP
    php: [
        'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
        'class', 'clone', 'const', 'continue', 'declare', 'default', 'die', 'do',
        'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach',
        'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final', 'finally',
        'for', 'foreach', 'function', 'global', 'goto', 'if', 'implements', 'include',
        'include_once', 'instanceof', 'insteadof', 'interface', 'isset', 'list', 'namespace',
        'new', 'or', 'print', 'private', 'protected', 'public', 'require', 'require_once',
        'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
        'var', 'while', 'xor', 'yield'
    ]
};

// 全言語の予約語を1つの配列にまとめる
const ALL_RESERVED_KEYWORDS = [
...new Set([
    ...RESERVED_KEYWORDS.js,
    ...RESERVED_KEYWORDS.python,
    ...RESERVED_KEYWORDS.java,
    ...RESERVED_KEYWORDS.c,
    ...RESERVED_KEYWORDS.csharp,
    ...RESERVED_KEYWORDS.ruby,
    ...RESERVED_KEYWORDS.php
])
];

// ファイル拡張子に基づいて適切な予約語セットを取得する関数
function getReservedKeywordsForLanguage(fileExtension: string): string[] {
    const ext = fileExtension.toLowerCase();

    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
        return RESERVED_KEYWORDS.js;
    } else if (['py', 'pyw'].includes(ext)) {
        return RESERVED_KEYWORDS.python;
    } else if (['java'].includes(ext)) {
        return RESERVED_KEYWORDS.java;
    } else if (['c', 'cpp', 'cc', 'h', 'hpp'].includes(ext)) {
        return RESERVED_KEYWORDS.c;
    } else if (['cs'].includes(ext)) {
        return RESERVED_KEYWORDS.csharp;
    } else if (['rb'].includes(ext)) {
        return RESERVED_KEYWORDS.ruby;
    } else if (['php'].includes(ext)) {
        return RESERVED_KEYWORDS.php;
    }

    // 不明な拡張子の場合は全ての予約語を返す
    return ALL_RESERVED_KEYWORDS;
}

// 検索行を記録するための拡張情報
interface OccurrenceInfo {
    documentUri: vscode.Uri;
    lineNumber: number;
    lineText: string;
    position: vscode.Position;
    searchText: string;
    searchTextLength: number;
}

// 履歴用のクラス
class HistoryItem {
    constructor(
        public readonly searchText: string,
        public readonly occurrenceInfo: OccurrenceInfo
    ) {}
}

// 階層構造をサポートするための拡張したTreeItemクラス
class TreeNode extends vscode.TreeItem {
    children: TreeNode[] = [];
    // parentを読み書き可能なプロパティとして定義
    parentNode?: TreeNode;

    constructor(
        label: string | vscode.TreeItemLabel,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }

    addChild(child: TreeNode): void {
        this.children.push(child);
        child.parentNode = this;
    }
}

// 検索履歴の表示用ノード
class SearchHistoryNode extends TreeNode {
    constructor() {
        const historyTitle = l10n.t('Line Search History');

        super(historyTitle, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon("history");
        this.tooltip = l10n.t('View and reuse past searches');
        this.contextValue = 'searchHistoryRoot';
    }
}

// 個々の検索履歴項目
class SearchHistoryItemNode extends TreeNode {
    private _isSelected: boolean = false;

    constructor(
        public readonly historyItem: HistoryItem
    ) {
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
        const textAfter = lineText.substring(
            startIndex + searchText.length,
            Math.min(lineText.length, startIndex + searchText.length + contextAfter)
        );

        // 行番号プレフィックス
        const linePrefix = l10n.t('Line {0}: ', lineNumber);

        // 完全なテキストを構築
        const fullText = `${linePrefix}${textBefore}${highlightedText}${textAfter}`;

        // ハイライト位置を計算
        const prefixLength = linePrefix.length;
        const highlightStart = prefixLength + textBefore.length;
        const highlightEnd = highlightStart + highlightedText.length;

        // TreeItemLabel としてラベルを設定
        const label: vscode.TreeItemLabel = {
            label: fullText,
            highlights: [[highlightStart, highlightEnd]]
        };

        super(label, vscode.TreeItemCollapsibleState.None);
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
    public set isSelected(value: boolean) {
        this._isSelected = value;
        this.updateIcon();
        // ラベルの更新方法も変更する必要がある（マーカーを追加するため）
        this.updateLabel();
    }

    // 選択状態を取得するメソッド
    public get isSelected(): boolean {
        return this._isSelected;
    }

    // アイコンを更新するメソッド
    private updateIcon() {
        // 検索履歴モードではチェックマークアイコンを表示せず、常に検索アイコンを表示
        if (isSearchHistoryMode) {
            this.iconPath = new vscode.ThemeIcon("search");
        } else {
            // 通常モードでは選択状態に応じてアイコンを変更
            if (this._isSelected) {
                this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("terminal.ansiGreen"));
            } else {
                this.iconPath = new vscode.ThemeIcon("search");
            }
        }
    }

    // ラベルを更新するメソッド - TextOccurrence クラスと同様の処理にする
    private updateLabel() {
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
            } else {
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
                } else if (!this._isSelected && hasMarker) {
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
        const message = l10n.t('Welcome to Range Navigator! 🔍');

        super(message, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon("star");

        // ツールチップも言語に基づいて設定
        this.tooltip = l10n.t('Range Navigator helps you find and visualize occurrences of selected text in your code.');
    }
}

// 使用方法ノード
class UsageInfoNode extends TreeNode {
    constructor() {
        // 言語に基づいてタイトルを変更
        const messageTitle = l10n.t('How to use:');

        super(messageTitle, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon("info");

        // 言語に基づいて使用方法の詳細を追加
        this.addChild(new InstructionNode(l10n.t('1. Select text in the editor'), 'selection'));
        this.addChild(new InstructionNode(l10n.t('2. All occurrences will be shown here'), 'list-tree'));
        this.addChild(new InstructionNode(l10n.t('3. Click on an item to navigate to it'), 'go-to-file'));
        this.addChild(new InstructionNode(l10n.t('4. Selected occurrences are highlighted'), 'symbol-color'));
    }
}

// 使用方法の各ステップノード
class InstructionNode extends TreeNode {
    constructor(
        instruction: string,
        iconName: string
    ) {
        super(instruction, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}

// コード構造ノード（クラス・関数などを表す）
class CodeStructureNode extends TreeNode {
    constructor(
        public readonly name: string,
        public readonly type: 'class' | 'function' | 'method' | 'other',
        public readonly range: vscode.Range,
        public readonly document: vscode.TextDocument,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded
    ) {
        // ラベルをカスタマイズしない（後で更新する）
        super(name, collapsibleState);

        // アイコンの設定（既存のコードと同じ）
        switch (type) {
            case 'class':
                this.iconPath = new vscode.ThemeIcon("symbol-class");
                break;
            case 'function':
                this.iconPath = new vscode.ThemeIcon("symbol-function");
                break;
            case 'method':
                this.iconPath = new vscode.ThemeIcon("symbol-method");
                break;
            default:
                this.iconPath = new vscode.ThemeIcon("symbol-misc");
        }

        // 設定からナビゲーション機能の有効/無効を取得
        const config = vscode.workspace.getConfiguration('rangeNavigator');
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

    // 子ノードが追加された後にラベルを更新するメソッドを追加
    updateLabelWithCount(): void {
        // 子ノードの数を取得（検索結果の件数）
        const count = this.children.length;

        // 件数を表示するラベルを作成
        let label = l10n.t('{0} ({1})', this.name, count);

        // ラベルを更新
        this.label = label;
    }
}

class TextOccurrence extends TreeNode {
    // ハイライト用の行範囲を追加
    public readonly lineRange: vscode.Range;
    // 初期値を設定して型エラーを解消
    private highlightInfo: { fullText: string; highlights: [number, number][] } = {
        fullText: "",
        highlights: [[0, 0]]
    };
    private _isSelected: boolean = false;
    private textBefore: string = "";
    private highlightedText: string = "";
    private textAfter: string = "";

    constructor(
        public readonly searchText: string,
        public readonly lineText: string,
        public readonly lineNumber: number,
        public readonly startIndex: number,
        public readonly position: vscode.Position,
        public readonly document: vscode.TextDocument,
        command?: vscode.Command
    ) {
        // TreeNodeの親クラスのコンストラクタにラベルを直接渡さない
        super("", vscode.TreeItemCollapsibleState.None);

        // 行全体の範囲を保存
        this.lineRange = new vscode.Range(
            lineNumber, 0,
            lineNumber, lineText.length
        );

        // テキストのコンテキストを準備
        const contextBefore = 20;
        const contextAfter = 30;
        const startPos = Math.max(0, startIndex - contextBefore);
        this.textBefore = lineText.substring(startPos, startIndex);
        this.highlightedText = lineText.substring(startIndex, startIndex + searchText.length);
        this.textAfter = lineText.substring(
            startIndex + searchText.length,
            Math.min(lineText.length, startIndex + searchText.length + contextAfter)
        );

        // 表示テキストを更新
        this.updateLabel();

        // 通常のアイコンを設定
        this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));
        this.tooltip = lineText.trim();

        // コマンドが指定されていなければデフォルトコマンドを設定
        if (!command) {
            this.command = {
                title: "Go to Occurrence",
                command: "rangeNavigator.gotoOccurrence",
                arguments: [document.uri, position, this.lineRange, searchText.length, this],
            };
        } else {
            this.command = command;
        }
    }

    // 選択状態を設定するメソッド
    public set isSelected(value: boolean) {
        this._isSelected = value;

        // 選択状態に応じてアイコンを変更
        if (this._isSelected) {
            this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("terminal.ansiGreen"));
        } else {
            this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));
        }

        // ラベルを更新
        this.updateLabel();
    }

    // 選択状態を取得するメソッド
    public get isSelected(): boolean {
        return this._isSelected;
    }

    // ラベルを更新するメソッド
    private updateLabel() {
        // 行番号プレフィックス
        let linePrefix = l10n.t('Line {0}: ', this.lineNumber + 1);

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
        } as vscode.TreeItemLabel;
    }
}

class RangeNavigatorProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private rootNodes: TreeNode[] = [];
    public searchHistoryNode: SearchHistoryNode | null = null;

    constructor(private context: vscode.ExtensionContext) {
        // 初期表示用のウェルカムメッセージを設定
        this.showWelcomeMessage();
    }

    // 特定のノードを更新するメソッド
    refreshNode(node: TreeNode): void {
        this._onDidChangeTreeData.fire(node);
    }

    // このメソッドは必須 - TreeDataProvider インターフェースで要求される
    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    // このメソッドも必須 - TreeDataProvider インターフェースで要求される
    getChildren(element?: TreeNode): Thenable<TreeNode[]> {
        if (!element) {
            return Promise.resolve(this.rootNodes);
        }
        return Promise.resolve(element.children);
    }

    // オプションだが実装すると便利
    getParent(element: TreeNode): vscode.ProviderResult<TreeNode> {
        return element.parentNode;
    }

    // 検索履歴を保存するためのメソッド
    saveSearchHistory(): void {
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
    showWelcomeMessage(): void {
        // ウェルカムメッセージのルートノードを作成
        const welcomeNode = new WelcomeMessageNode();
        const usageNode = new UsageInfoNode();

        // 検索履歴ノードを初期化するが、通常モードでは表示しない
        this.searchHistoryNode = new SearchHistoryNode();
        this.updateSearchHistoryNode();

        // 検索履歴モードの場合のみ表示、通常モードでは追加しない
        if (isSearchHistoryMode) {
            this.rootNodes = [this.searchHistoryNode];
        } else {
            this.rootNodes = [welcomeNode, usageNode];
        }

        this._onDidChangeTreeData.fire();

        // ウェルカムメッセージを表示済みとしてマーク
        hasShownWelcomeMessage = true;
    }

    // 検索履歴ノードを更新する
    updateSearchHistoryNode(): void {
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

    refresh(rootNodes: TreeNode[]): void {
        // 検索履歴モードの場合
        if (isSearchHistoryMode) {
            // 検索履歴モードでは、rootNodesをそのまま使用
            this.rootNodes = rootNodes;
        } else {
            // 通常モードでは検索履歴ノードを追加しない
            this.rootNodes = rootNodes;
        }

        this._onDidChangeTreeData.fire();
    }
}

// コードの構造（クラス、関数など）を解析する機能
async function parseCodeStructure(document: vscode.TextDocument): Promise<CodeStructureNode[]> {
    const structures: CodeStructureNode[] = [];
    const text = document.getText();

    // ファイル拡張子を取得して言語を特定
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';

    // 言語に応じた予約語セットを取得
    const languageKeywords = getReservedKeywordsForLanguage(fileExtension);

    // 様々な言語のクラス定義に対応するパターン
    const classPattern = /\b(?:class|struct|interface|trait|enum|record)\s+(\w+)(?:\s+(?:extends|implements|:|<|inherits|with)\s+[\w\s,<>]+)?/g;

    // 様々な言語の関数定義に対応するパターン
    const functionPattern = /\b(?:function|func|fn|def|sub|procedure|proc|method|fun|public|private|protected|static|async)\s+(\w+)\s*\([^)]*\)/g;

    // 様々な言語のメソッド定義に対応するパターン
    const methodPattern = /(?:\b(?:public|private|protected|internal|final|override|virtual|static|async)(?:\s+|\s+\w+\s+))?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\],\s]+\s*)?(?:{\s*|=>|throws|is|as|->)/g;

    // Python特有のインデントベースのブロック定義パターン
    const pythonDefPattern = /\bdef\s+(\w+)\s*\([^)]*\):/g;
    const pythonClassPattern = /\bclass\s+(\w+)(?:\([\w\s,]+\))?:/g;

    // 言語ごとの特殊処理を適用
    if (['py', 'pyw'].includes(fileExtension)) {
        // Pythonファイルの特殊処理
        return await parsePythonStructure(document, text);
    }

    // クラスを検索
    let match;
    while ((match = classPattern.exec(text)) !== null) {
        const className = match[1];
        const startPos = document.positionAt(match.index);

        // クラスの終了位置を特定（言語によって異なる可能性がある）
        let classEndIndex;

        // 予約語の場合はスキップ
        if (languageKeywords.includes(className)) {
            continue;
        }

        // 括弧ベースの言語（Java, C#, JavaScript など）
        classEndIndex = findMatchingBrace(text, document.offsetAt(startPos));

        const endPos = classEndIndex !== -1 ?
            document.positionAt(classEndIndex) :
            document.positionAt(text.length);

        const range = new vscode.Range(startPos, endPos);
        const classNode = new CodeStructureNode(className, 'class', range, document);
        structures.push(classNode);

        // クラス本体のテキストを抽出して解析
        const classBodyText = text.substring(
            document.offsetAt(startPos),
            document.offsetAt(endPos)
        );

        // メソッドをクラス内で検索
        const methodRegex = new RegExp(methodPattern);
        let methodMatch;

        // クラス本体内でのオフセットを計算するための基準値
        const classBodyOffset = document.offsetAt(startPos);

        while ((methodMatch = methodRegex.exec(classBodyText)) !== null) {
            const methodName = methodMatch[1];

            // メソッド名がconstructorでない場合のみ処理（コンストラクタは特別扱い）
            // 各言語固有のコンストラクタ名をチェック
            const constructorNames = ['constructor', '__init__', '__construct', 'New', 'init'];
            if (!constructorNames.includes(methodName)) {
                // クラス内でのメソッドの位置を計算
                const methodStartOffset = classBodyOffset + methodMatch.index;
                const methodStartPos = document.positionAt(methodStartOffset);

                // メソッドの終了位置を特定
                const methodEndIndex = findMatchingBrace(text, methodStartOffset);
                const methodEndPos = methodEndIndex !== -1 ?
                    document.positionAt(methodEndIndex) :
                    document.positionAt(text.length);

                const methodRange = new vscode.Range(methodStartPos, methodEndPos);
                const methodNode = new CodeStructureNode(
                    methodName,
                    'method',
                    methodRange,
                    document
                );

                // メソッドをクラスの子ノードとして追加
                classNode.addChild(methodNode);
            }
        }
    }

    // 独立した関数を検索（クラス外の関数）
    while ((match = functionPattern.exec(text)) !== null) {
        const functionName = match[1];
        const startPos = document.positionAt(match.index);

        // 予約語の場合はスキップ
        if (languageKeywords.includes(functionName)) {
            continue;
        }

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

        const range = new vscode.Range(startPos, endPos);
        structures.push(new CodeStructureNode(functionName, 'function', range, document));
    }

    return structures;
}

// 対応する閉じ括弧を見つける簡易的な関数
function findMatchingBrace(text: string, startOffset: number): number {
    // 開始括弧を見つける
    let openBracePos = -1;
    for (let i = startOffset; i < text.length; i++) {
        if (text[i] === '{') {
            openBracePos = i;
            break;
        } else if (text[i] === ';') {
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
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                return i + 1; // 閉じ括弧の次の位置
            }
        }
    }

    return -1; // 対応する閉じ括弧が見つからない
}

// Python特有のインデントベースの構造を解析する
async function parsePythonStructure(document: vscode.TextDocument, text: string): Promise<CodeStructureNode[]> {
    const structures: CodeStructureNode[] = [];
    const lines = text.split("\n");

    // Pythonのクラスパターンとメソッドパターン
    const classPattern = /^\s*class\s+(\w+)(?:\([\w\s,]+\))?:/;
    const methodPattern = /^\s*def\s+(\w+)\s*\([^)]*\):/;
    const functionPattern = /^\s*def\s+(\w+)\s*\([^)]*\):/;

    // インデントとノード情報を格納する配列
    type NodeInfo = {
        node: CodeStructureNode;
        indentLevel: number;
        startLine: number;
        parent?: NodeInfo;
        children: NodeInfo[];
    };

    const nodeInfos: NodeInfo[] = [];
    const rootNodes: NodeInfo[] = [];

    // スタック（現在のインデントコンテキスト）
    // [インデントレベル, 親ノード情報]
    let currentContext: [number, NodeInfo | undefined] = [0, undefined];

    // 1回目のパス: ノード構造を構築
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 空行やコメント行はスキップ
        if (line.trim() === '' || line.trim().startsWith('#')) {
            continue;
        }

        // インデントレベルを計算
        const indentMatch = line.match(/^(\s*)/);
        const indentLevel = indentMatch ? indentMatch[1].length : 0;

        // 現在のコンテキストよりインデントが少ない場合、前のコンテキストに戻る
        if (indentLevel < currentContext[0]) {
            // 親ノードを探す
            let parent = currentContext[1]?.parent;
            while (parent && parent.indentLevel >= indentLevel) {
                parent = parent.parent;
            }

            currentContext = [indentLevel, parent];
        }

        // クラス定義
        const classMatch = line.match(classPattern);
        if (classMatch) {
            const className = classMatch[1];
            const startPos = new vscode.Position(i, 0);
            // 仮の終了位置（後で更新）
            const endPos = new vscode.Position(i + 1, 0);

            const classNode = new CodeStructureNode(
                className,
                'class',
                new vscode.Range(startPos, endPos),
                document
            );

            const nodeInfo: NodeInfo = {
                node: classNode,
                indentLevel: indentLevel,
                startLine: i,
                parent: currentContext[1],
                children: []
            };

            // 親がある場合は子として追加
            if (currentContext[1]) {
                currentContext[1].children.push(nodeInfo);
            } else {
                // ルートノードとして追加
                rootNodes.push(nodeInfo);
            }

            nodeInfos.push(nodeInfo);
            // 新しいコンテキストに切り替え
            currentContext = [indentLevel, nodeInfo];
            continue;
        }

        // メソッド定義
        const methodMatch = line.match(methodPattern);
        if (methodMatch && currentContext[1] && currentContext[1].node.type === 'class') {
            // クラスコンテキスト内の場合はメソッド
            const methodName = methodMatch[1];
            const startPos = new vscode.Position(i, 0);
            // 仮の終了位置
            const endPos = new vscode.Position(i + 1, 0);

            const methodNode = new CodeStructureNode(
                methodName,
                'method',
                new vscode.Range(startPos, endPos),
                document
            );

            const nodeInfo: NodeInfo = {
                node: methodNode,
                indentLevel: indentLevel,
                startLine: i,
                parent: currentContext[1],
                children: []
            };

            currentContext[1].children.push(nodeInfo);
            nodeInfos.push(nodeInfo);

            // 新しいコンテキストに切り替え
            currentContext = [indentLevel, nodeInfo];
            continue;
        }

        // クラス外の関数定義
        const functionMatch = line.match(functionPattern);
        if (functionMatch && (!currentContext[1] || currentContext[1].node.type !== 'class')) {
            // クラスコンテキスト外の場合は関数
            const functionName = functionMatch[1];
            const startPos = new vscode.Position(i, 0);
            // 仮の終了位置
            const endPos = new vscode.Position(i + 1, 0);

            const functionNode = new CodeStructureNode(
                functionName,
                'function',
                new vscode.Range(startPos, endPos),
                document
            );

            const nodeInfo: NodeInfo = {
                node: functionNode,
                indentLevel: indentLevel,
                startLine: i,
                parent: currentContext[1],
                children: []
            };

            // 親がある場合は子として追加
            if (currentContext[1]) {
                currentContext[1].children.push(nodeInfo);
            } else {
                // ルートノードとして追加
                rootNodes.push(nodeInfo);
            }

            nodeInfos.push(nodeInfo);

            // 新しいコンテキストに切り替え
            currentContext = [indentLevel, nodeInfo];
        }
    }

    // 2回目のパス: 終了位置を計算して実際のノード階層を構築
    for (let i = 0; i < nodeInfos.length; i++) {
        const nodeInfo = nodeInfos[i];
        const nextNodeWithLessIndent = nodeInfos.slice(i + 1).find(n => n.indentLevel <= nodeInfo.indentLevel);

        let endLine: number;
        if (nextNodeWithLessIndent) {
            // 次のより浅いインデントのノードまで
            endLine = nextNodeWithLessIndent.startLine - 1;
        } else {
            // ファイルの終わりまで
            endLine = lines.length - 1;
        }

        // 新しいインスタンスを作成（range読み取り専用対策）
        const newNode = new CodeStructureNode(
            nodeInfo.node.name,
            nodeInfo.node.type,
            new vscode.Range(
                nodeInfo.node.range.start,
                new vscode.Position(endLine + 1, 0)
            ),
            document
        );

        // 子ノードの追加
        for (const childInfo of nodeInfo.children) {
            // 先に子ノードからツリーを構築（後順トラバース）
            const index = nodeInfos.indexOf(childInfo);
            if (index > i) {
                // まだ処理していない子ノードの場合はスキップ
                continue;
            }

            // 子ノードを追加
            newNode.addChild(childInfo.node);
        }

        // 親ノードに追加
        if (nodeInfo.parent) {
            // 親ノードが既に処理済みで更新されている場合
            const parentIndex = nodeInfos.indexOf(nodeInfo.parent);
            if (parentIndex < i) {
                // 親を探してnodeInfosから削除
                const rootIndex = rootNodes.indexOf(nodeInfo.parent);
                if (rootIndex >= 0) {
                    structures.push(newNode);
                } else {
                    // 処理済みのノードを探す
                    for (const structure of structures) {
                        if (addToParentIfFound(structure, nodeInfo.parent.node.name, newNode)) {
                            break;
                        }
                    }
                }
            }
        } else {
            // ルートノード
            structures.push(newNode);
        }

        // 古いノードを新しいノードで置き換え
        nodeInfo.node = newNode;
    }

    // 最終的なルートノードの構築
    const finalStructures: CodeStructureNode[] = [];

    for (const nodeInfo of rootNodes) {
        // 最新のノードを使用
        finalStructures.push(nodeInfo.node);
    }

    return finalStructures;
}

// 親ノードを探して子ノードを追加するヘルパー関数
function addToParentIfFound(node: CodeStructureNode, parentName: string, childNode: CodeStructureNode): boolean {
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
function organizeOccurrencesByStructure(
    occurrences: TextOccurrence[],
    structures: CodeStructureNode[],
    document: vscode.TextDocument
): TreeNode[] {
    // 構造化された新しいノードツリーを作成
    const rootNodes: TreeNode[] = [];

    // まず、構造ノードの新しいインスタンスを作成
    for (const structure of structures) {
        // 予約語の名前を持つノードは作成しない
        const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';
        const languageKeywords = getReservedKeywordsForLanguage(fileExtension);

        if (languageKeywords.includes(structure.name)) {
            continue; // 予約語の名前を持つ構造はスキップ
        }

        const newNode = new CodeStructureNode(
            structure.name,
            structure.type,
            structure.range,
            document
        );

        // 子ノードを再帰的に処理
        for (const child of structure.children) {
            if (child instanceof CodeStructureNode) {
                // 子ノードも予約語チェック
                if (languageKeywords.includes(child.name)) {
                    continue; // 予約語の名前を持つ子構造はスキップ
                }

                const childNode = new CodeStructureNode(
                    child.name,
                    child.type,
                    child.range,
                    document
                );
                newNode.addChild(childNode);
            }
        }

        rootNodes.push(newNode);
    }

    // 未分類の検索結果を格納するノード
    const uncategorizedNode = new TreeNode(
        l10n.t("📍 Other Occurrences"),
        vscode.TreeItemCollapsibleState.Expanded
    );

    let hasUncategorized = false;

    // ファイル拡張子を取得
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';

    // 言語に応じた予約語セットを取得
    const languageKeywords = getReservedKeywordsForLanguage(fileExtension);

    // 各出現箇所に関連付け情報を追加
    for (const occurrence of occurrences) {
        const position = occurrence.position;
        let matched = false;

        // 現在の行のテキストを取得
        const lineText = document.lineAt(position.line).text;

        // 予約語を含む行かどうかをチェック
        const isReservedKeywordLine = languageKeywords.some(keyword => {
            // 予約語に続いて制御構文のパターンがあるかをチェック
            const keywordPattern = new RegExp(`\\b${keyword}\\b\\s*\\(`);
            return keywordPattern.test(lineText);
        });

        // 予約語を含む行の場合は常に「その他」カテゴリに分類
        if (isReservedKeywordLine) {
            uncategorizedNode.addChild(occurrence);
            hasUncategorized = true;
            matched = true;
            continue;
        }

        // 出現箇所が属する最も詳細な構造を見つけるループ
        for (let i = 0; i < rootNodes.length; i++) {
            const node = rootNodes[i];

            // CodeStructureNodeの場合のみチェック
            if (node instanceof CodeStructureNode) {
                // 予約語のノードだった場合、子ノードにしない
                if (languageKeywords.includes(node.name)) {
                    continue;
                }

                // 位置が構造の範囲内かチェック
                if (node.range.contains(position)) {
                    // クラス内のメソッドをチェック - これも予約語チェックを追加
                    let methodMatched = false;
                    if (node.type === 'class') {
                        for (let j = 0; j < node.children.length; j++) {
                            const childNode = node.children[j];
                            if (childNode instanceof CodeStructureNode &&
                                childNode.type === 'method' &&
                                !languageKeywords.includes(childNode.name) && // 予約語チェック
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
        uncategorizedNode.label = l10n.t('📍 Other Occurrences ({0})', uncategorizedNode.children.length);
        filteredRootNodes.push(uncategorizedNode);
    }

    return filteredRootNodes;
}
export function activate(context: vscode.ExtensionContext) {
    console.log("Activating Range Navigator extension");

    // 拡張機能のコンテキストから検索履歴を読み込む
    const savedHistory = context.globalState.get('searchHistory', []) as any[];

    try {
        // 型が配列の場合のみ処理
        if (Array.isArray(savedHistory)) {
            // 保存された履歴を復元
            searchHistory = savedHistory.map(item => {
                if (item && typeof item === 'object' && 'documentUri' in item) {
                    // 新しいフォーマットの場合
                    const position = new vscode.Position(item.lineNumber, item.character);
                    const occurrenceInfo: OccurrenceInfo = {
                        documentUri: vscode.Uri.parse(item.documentUri),
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
            }).filter(item => item !== null) as HistoryItem[];
        } else {
            // 配列でない場合は空の配列で初期化
            searchHistory = [];
        }
    } catch (error) {
        console.error("Error loading search history:", error);
        // エラーが発生した場合は空の配列で初期化
        searchHistory = [];
    }

    // 以下は既存のコード
    // コンテキスト変数を初期化
    updateSearchContext(false);

    const config = vscode.workspace.getConfiguration('rangeNavigator');
    const backgroundColor = config.get('highlight.backgroundColor', 'rgba(255, 165, 0, 0.3)');
    const borderColor = config.get('highlight.borderColor', 'rgba(255, 140, 0, 0.8)');
    const scrollbarColor = config.get('highlight.scrollbarColor', 'rgba(255, 165, 0, 0.7)');

    // 設定が変更された場合にウィンドウをリロードするためのイベントリスナーを登録
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('rangeNavigator.highlight.backgroundColor')
				|| e.affectsConfiguration('rangeNavigator.highlight.borderColor')
				|| e.affectsConfiguration('rangeNavigator.enableNavigationOnClick')
		) {

				const answer = await vscode.window.showInformationMessage(
					l10n.t("Range Navigator: Settings have been changed. A window reload is required to apply the changes. Do you want to reload now?"),
					l10n.t("Yes"),
					l10n.t("No")
				);

				if (answer === l10n.t("Yes")) {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			}
		})
	);

    // ハイライト用のデコレーションタイプを作成
    highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        border: '1px solid',
        borderColor: borderColor,
        isWholeLine: true,
        // スクロールバーに表示するための設定を追加
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode.OverviewRulerLane.Center
    });

    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    const treeView = vscode.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: false,
    });

    // 履歴から行に移動するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('rangeNavigator.gotoHistoryLine',
            async (historyItem: HistoryItem, historyItemNode?: SearchHistoryItemNode) => {
                const docUri = historyItem.occurrenceInfo.documentUri;
                const position = historyItem.occurrenceInfo.position;
                const lineNumber = historyItem.occurrenceInfo.lineNumber;
                const searchText = historyItem.searchText;
                const searchTextLength = historyItem.occurrenceInfo.searchTextLength;

                // 検索履歴から該当項目を削除して先頭に追加することで最新の履歴にする
                const historyIndex = searchHistory.findIndex(item =>
                    item.occurrenceInfo.documentUri.toString() === docUri.toString() &&
                    item.occurrenceInfo.lineNumber === lineNumber &&
                    item.searchText === searchText
                );

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
                    vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);
                }

                // サイドバーからのナビゲーションフラグを設定
                isNavigatingFromSidebar = true;

                try {
                    // ドキュメントを開く
                    const editor = await vscode.window.showTextDocument(docUri);
                    const document = editor.document;

                    // 行番号が有効かチェック
                    if (lineNumber >= 0 && lineNumber < document.lineCount) {
                        // 行の現在のテキストを取得
                        const currentLineText = document.lineAt(lineNumber).text;

                        // 検索テキストが現在の行に含まれているか確認
                        if (currentLineText.includes(searchText)) {
                            // 検索テキストの現在の位置を探す
                            const currentIndex = currentLineText.indexOf(searchText);
                            const currentPosition = new vscode.Position(lineNumber, currentIndex);
                            const selectionEnd = new vscode.Position(lineNumber, currentIndex + searchTextLength);

                            // 検索テキストを選択
                            editor.selection = new vscode.Selection(currentPosition, selectionEnd);

                            // 見やすいようにスクロール位置を調整
                            editor.revealRange(
                                new vscode.Range(currentPosition, selectionEnd),
                                vscode.TextEditorRevealType.InCenter
                            );

                            // 行ハイライトを適用
                            const lineRange = new vscode.Range(
                                lineNumber, 0,
                                lineNumber, currentLineText.length
                            );

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
                        } else {
                            // 検索テキストが行にない場合はカーソル位置だけ移動
                            const linePosition = new vscode.Position(lineNumber, 0);
                            editor.selection = new vscode.Selection(linePosition, linePosition);

                            // 見やすいようにスクロール位置を調整
                            editor.revealRange(
                                new vscode.Range(linePosition, linePosition),
                                vscode.TextEditorRevealType.InCenter
                            );

                            // ハイライトは行わないが、最後に検索したテキストを更新
                            lastSearchedText = searchText;

                            // 通常モードで検索結果を表示
                            findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider);

                            // 操作完了後にフラグをリセット
                            setTimeout(() => {
                                isNavigatingFromSidebar = false;
                            }, 300);

                            // 検索テキストが見つからない旨をメッセージ表示
                            vscode.window.showInformationMessage(
                                l10n.t('The search text {0} is not found in the current line.', searchText)
                            );
                        }
                    } else {
                        // 無効な行番号の場合
                        vscode.window.showWarningMessage(
                            l10n.t('The specified line number ({0}) is outside the document range.', lineNumber + 1)
                        );
                        isNavigatingFromSidebar = false;
                    }
                } catch (error) {
                    console.error("Error navigating to history line:", error);
                    vscode.window.showErrorMessage(l10n.t('Error navigating to history line.'));
                    isNavigatingFromSidebar = false;
                }
            }
        )
    );

    // 検索履歴を表示するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('range-navigator.showSearchHistory', () => {
            // 検索履歴モードでない場合（通常モードの場合）は、履歴を表示する
            if (!isSearchHistoryMode) {
                // 現在の選択状態を保存（モード切替前に保存することが重要）
                const currentSelection = selectedOccurrence;

                // 履歴モードに切り替え
                isSearchHistoryMode = true;
                vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', true);

                // 履歴モードに切り替える際は一時的に選択状態を解除するが、変数自体は保持
                if (selectedOccurrence) {
                    // 選択状態を視覚的に解除するだけ
                    selectedOccurrence.isSelected = false;
                    rangeNavigatorProvider.refreshNode(selectedOccurrence);
                    // ここで selectedOccurrence 自体は null にしない
                }

                // 検索履歴のみを表示
                showSearchHistoryOnly(rangeNavigatorProvider);
            } else {
                // 通常モードに切り替え
                isSearchHistoryMode = false;
                vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);

                // 通常モードに戻す
                if (lastSearchedText) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        // 最後の検索テキストを使用して検索結果を表示
                        findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
                    }
                } else {
                    // 検索テキストがない場合はウェルカムメッセージを表示
                    rangeNavigatorProvider.showWelcomeMessage();
                }
            }
        })
    );

    // 履歴から再検索するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('rangeNavigator.searchAgain',
            async (searchText: string) => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return vscode.window.showWarningMessage(l10n.t('No active editor found.'));
                }

                // 検索履歴モードを解除
                isSearchHistoryMode = false;
                vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);

                // 選択テキストを設定して検索を実行
                lastSearchedText = searchText;
                await findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider);
            }
        )
    );

    // 履歴をクリアするコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('range-navigator.clearHistory', () => {
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
                    emptyHistoryNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    rangeNavigatorProvider.refresh([emptyHistoryNode]);
                } else {
                    // 通常モードの場合はウェルカムメッセージを表示
                    rangeNavigatorProvider.showWelcomeMessage();
                }
            }

            vscode.window.showInformationMessage(l10n.t('Search history has been cleared.'));
        })
    );

	// ツリービューを折りたたむコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand("range-navigator.collapseAll", () => {
			console.log("Range Navigator: Collapse All");
			vscode.commands.executeCommand('workbench.actions.treeView.rangeNavigatorView.collapseAll');
		})
	);

	// ツリービューを展開するコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand("range-navigator.expandAll", () => {
			expandAll(treeView, rangeNavigatorProvider);
		})
	);

    // クリックされた行への移動とハイライト表示を行うコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('rangeNavigator.gotoOccurrence',
            (docUri: vscode.Uri, position: vscode.Position, range: vscode.Range, searchTextLength: number, occurrence: TextOccurrence) => {
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

                vscode.window.showTextDocument(docUri).then(editor => {
                    console.log(`Selected text1: "${editor.document.getText(editor.selection)}"`);
                    // 検索テキストの範囲全体を選択
                    const selectionEnd = new vscode.Position(position.line, position.character + searchTextLength);
                    editor.selection = new vscode.Selection(position, selectionEnd);
                    console.log(`Selected text2: "${editor.document.getText(editor.selection)}"`);

                    // 見やすいようにスクロール位置を調整
                    editor.revealRange(
                        new vscode.Range(position, selectionEnd),
                        vscode.TextEditorRevealType.InCenter
                    );

                    // 行ハイライトを適用
                    setTimeout(() => {
                        // 現在の行の最新の範囲を取得
                        const currentLine = editor.document.lineAt(position.line);
                        const updatedRange = new vscode.Range(
                            position.line, 0,
                            position.line, currentLine.text.length
                        );

                        highlightSelectedLine(editor, updatedRange);
                        // 操作完了後にフラグをリセット
                        setTimeout(() => {
                            isNavigatingFromSidebar = false;
                        }, 300);
                    }, 100);

                    // クリックされた行を履歴に追加
                    const searchText = editor.document.getText(editor.selection);
                    if (searchText && searchText.length > 0) {
                        // 履歴情報を作成
                        const occurrenceInfo: OccurrenceInfo = {
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
            }
        )
    );

    // 定義位置に移動するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('rangeNavigator.gotoDefinition',
            (docUri: vscode.Uri, position: vscode.Position, range: vscode.Range) => {
                // サイドバーからのナビゲーションフラグを設定
                isNavigatingFromSidebar = true;

                vscode.window.showTextDocument(docUri).then(editor => {
                    // カーソルを定義位置に移動
                    editor.selection = new vscode.Selection(position, position);

                    // 見やすいようにスクロール位置を調整
                    editor.revealRange(
                        range,
                        vscode.TextEditorRevealType.InCenter
                    );

                    // 行ハイライトを適用
                    setTimeout(() => {
                        highlightSelectedLine(editor, new vscode.Range(
                            position.line, 0,
                            position.line, editor.document.lineAt(position.line).text.length
                        ));
                        // 操作完了後にフラグをリセット
                        setTimeout(() => {
                            isNavigatingFromSidebar = false;
                        }, 300);
                    }, 100);
                });
            }
        )
    );

    // 選択テキスト変更イベントハンドラ
    let previousSelection: vscode.Selection | undefined;

    // 選択テキスト変更イベントハンドラ
    const handleSelectionChange = async (editor: vscode.TextEditor | undefined) => {
        if (!editor || !treeView.visible) {
            return;
        };

        const selection = editor.selection;

        // サイドバーからのナビゲーション中は処理をスキップ
        if (isNavigatingFromSidebar) {
            return;
        }

        // 範囲選択の場合のみハイライトをクリア
        if (!selection.isEmpty) {
            // 前回も範囲選択だった場合、もしくは初めての範囲選択の場合
            clearHighlights(editor);

            const selectedText = editor.document.getText(selection);
            if (selectedText && selectedText.length > 0) {
                console.log(`Selected text: "${selectedText}"`);
                lastSearchedText = selectedText;  // 最後に検索したテキストを保存
                await findOccurrencesInStructure(editor, selectedText, rangeNavigatorProvider);
            }
        } else {
            // カーソル位置の変更だけの場合（範囲選択なし）
            // 選択がクリアされた場合でも、ハイライトとサイドバーの結果を維持
            if (lastSearchedText) {
                // 何もしない - ハイライトと検索結果はそのまま表示
            } else {
                // 検索結果がない場合はウェルカムメッセージを表示
                rangeNavigatorProvider.showWelcomeMessage();
            }
        }

        // 現在の選択状態を保存
        previousSelection = selection;
    };

    // 検索をクリアするコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('range-navigator.clearSearch', () => {
            const editor = vscode.window.activeTextEditor;
            clearSearch(rangeNavigatorProvider, editor);
        })
    );

    // テキスト選択変更イベント
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((event) => {
            handleSelectionChange(event.textEditor);
        })
    );

    // サイドバー表示状態変更イベント
    context.subscriptions.push(
        treeView.onDidChangeVisibility((event) => {
            if (event.visible) {
                // サイドバーが表示されたとき、アクティブエディタに最後の検索テキストがあればそれを使用
                const editor = vscode.window.activeTextEditor;
                if (editor && lastSearchedText) {
                    findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
                } else if (editor) {
                    handleSelectionChange(editor);
                } else {
                    // エディタが開かれていない場合はウェルカムメッセージを表示
                    rangeNavigatorProvider.showWelcomeMessage();
                }
            } else if (vscode.window.activeTextEditor) {
                clearHighlights(vscode.window.activeTextEditor);
            }
        })
    );

    // エディタ変更イベント
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (selectedOccurrence) {
                selectedOccurrence.isSelected = false;
                rangeNavigatorProvider.refreshNode(selectedOccurrence);
                selectedOccurrence = null;
            }
            if (treeView.visible) {
                if (editor && lastSearchedText) {
                    // 新しいエディタが開かれたとき、最後の検索テキストを使用
                    findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
                } else if (editor) {
                    handleSelectionChange(editor);
                } else {
                    // エディタが開かれていない場合はウェルカムメッセージを表示
                    rangeNavigatorProvider.showWelcomeMessage();
                }
            }
        })
    );

    // 手動で検索を実行するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('range-navigator.findOccurrences', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return vscode.window.showWarningMessage(l10n.t('No active editor found.'));
            }

            const selection = editor.selection;
            if (!selection.isEmpty) {
                const selectedText = editor.document.getText(selection);
                if (selectedText && selectedText.length > 0) {
                    lastSearchedText = selectedText;
                    await findOccurrencesInStructure(editor, selectedText, rangeNavigatorProvider);

                    // サイドバーを開く
                    await vscode.commands.executeCommand('rangeNavigatorView.focus');
                }
            } else {
                // 選択がない場合は、ユーザーに検索テキストの入力を促す
                const searchText = await vscode.window.showInputBox({
                    placeHolder: l10n.t('Enter text to search for'),
                    prompt: l10n.t('Search for text in the current document')
                });

                if (searchText && searchText.length > 0) {
                    lastSearchedText = searchText;
                    await findOccurrencesInStructure(editor, searchText, rangeNavigatorProvider);

                    // サイドバーを開く
                    await vscode.commands.executeCommand('rangeNavigatorView.focus');
                }
            }
        })
    );

    // テキスト変更イベント - 文書が変更されたときの処理
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const editor = vscode.window.activeTextEditor;
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
                    const updatedRange = new vscode.Range(
                        foundLine, 0,
                        foundLine, document.lineAt(foundLine).text.length
                    );

                    editor.setDecorations(highlightDecorationType, [updatedRange]);
                    currentHighlightRange = updatedRange;
                    // テキスト内容は変わっていないので更新不要
                } else {
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
        })
    );

    context.subscriptions.push(treeView);

    // メッセージをコピーするコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('range-navigator.copyMessage', async (node) => {
            if (node && node.label) {
                // ノードのラベルをクリップボードにコピー
                let messageText = "";

                // TreeItemLabelオブジェクトかどうかを確認
                if (typeof node.label === 'object' && node.label.label) {
                    messageText = node.label.label;
                } else if (typeof node.label === 'string') {
                    messageText = node.label;
                }

                if (messageText) {
                    await vscode.env.clipboard.writeText(messageText);
                    vscode.window.showInformationMessage(l10n.t('Message copied to clipboard!'));
                }
            }
        })
    );
}

// 検索結果の全出現箇所をスクロールバーに表示する関数を追加
function highlightAllOccurrencesInScrollbar(editor: vscode.TextEditor, occurrences: TextOccurrence[]) {
    // 設定から色を読み込む
    const config = vscode.workspace.getConfiguration('rangeNavigator');
    const scrollbarColor = config.get('highlight.scrollbarColor', 'rgba(255, 165, 0, 0.7)');

    // 出現箇所の範囲を収集
    const ranges: vscode.Range[] = occurrences.map(occurrence => {
        return new vscode.Range(
            occurrence.lineNumber, occurrence.startIndex,
            occurrence.lineNumber, occurrence.startIndex + occurrence.searchText.length
        );
    });

    // スクロールバーハイライト用のデコレーションタイプ
    const scrollbarDecorationType = vscode.window.createTextEditorDecorationType({
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode.OverviewRulerLane.Center
    });

    // スクロールバーにハイライトを適用
    editor.setDecorations(scrollbarDecorationType, ranges);
}

// 検索結果から指定の行・位置に一致するTextOccurrenceを選択状態にするヘルパー関数を追加
function updateOccurrenceSelection(
    provider: RangeNavigatorProvider,
    lineNumber: number,
    startIndex: number,
    searchText: string
): void {
    // 前の選択をクリア
    if (selectedOccurrence) {
        selectedOccurrence.isSelected = false;
        provider.refreshNode(selectedOccurrence);
        selectedOccurrence = null;
    }

    // ツリー内のノードを再帰的に探索する関数
    function findOccurrenceNode(nodes: TreeNode[]): TextOccurrence | null {
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
function findHistoryNodeByItem(provider: RangeNavigatorProvider, item: HistoryItem): SearchHistoryItemNode | null {
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
function addToLineHistory(
    searchText: string,
    occurrenceInfo: OccurrenceInfo,
    provider: RangeNavigatorProvider
): void {
    // 設定から最大履歴数を取得
    const config = vscode.workspace.getConfiguration('rangeNavigator');
    const maxHistorySize = config.get('history.maxSize', 10);

    // 新しい履歴アイテムを作成
    const newItem = new HistoryItem(searchText, occurrenceInfo);

    // 重複する履歴を探す
    const duplicateIndex = searchHistory.findIndex(item =>
        item.occurrenceInfo.documentUri.toString() === occurrenceInfo.documentUri.toString() &&
        item.occurrenceInfo.lineNumber === occurrenceInfo.lineNumber &&
        item.searchText === searchText
    );

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
function showSearchHistoryOnly(provider: RangeNavigatorProvider): void {
    // 検索履歴ノードのみを表示
    const historyNode = new SearchHistoryNode();

    // 検索履歴がない場合の表示
    if (searchHistory.length === 0) {
        const emptyNode = new TreeNode(
            l10n.t('No history available.'),
            vscode.TreeItemCollapsibleState.None
        );
        emptyNode.iconPath = new vscode.ThemeIcon("info");
        historyNode.addChild(emptyNode);
    } else {
        // 検索履歴を更新（選択状態を常に非選択に設定）
        for (const item of searchHistory) {
            const historyItem = new SearchHistoryItemNode(item);
            // 明示的に選択状態をfalseに設定する
            historyItem.isSelected = false;
            historyNode.addChild(historyItem);
        }
    }

    // 見出し表示を変更
    historyNode.label = l10n.t('Line Search History');

    // 検索履歴を常に展開表示
    historyNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

    // ツリービューを更新（検索履歴ノードのみを表示）
    provider.refresh([historyNode]);
}

// すべて展開関数の定義
async function expandAll(treeView: vscode.TreeView<any>, provider: vscode.TreeDataProvider<any>) {
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
function clearHighlights(editor: vscode.TextEditor) {
    editor.setDecorations(highlightDecorationType, []);
    // ハイライト情報をリセット
    currentHighlightRange = null;
    currentHighlightLineContent = null;
}

// 指定された行をハイライトする関数
function highlightSelectedLine(editor: vscode.TextEditor, range: vscode.Range) {
    clearHighlights(editor);
    editor.setDecorations(highlightDecorationType, [range]);
    console.log(`Highlighting line ${range.start.line + 1}`);

    // 現在のハイライト範囲とその行の内容を保存
    currentHighlightRange = range;
    currentHighlightLineContent = editor.document.lineAt(range.start.line).text;
}

// 指定されたテキストの出現箇所をすべて検索し、コード構造と関連付ける
function updateSearchContext(hasSearchText: boolean): void {
    vscode.commands.executeCommand('setContext', 'lastSearchedText', hasSearchText);
}

// findOccurrencesInStructure関数内の修正
async function findOccurrencesInStructure(
    editor: vscode.TextEditor,
    searchText: string,
    provider: RangeNavigatorProvider,
    prevSelection: TextOccurrence | null = null // 引数追加
): Promise<void> {
    const document = editor.document;
    const results: TextOccurrence[] = [];

    // 明示的にboolean型に変換する
    const hasValidSearchText = Boolean(searchText && searchText.trim() !== "");
    // コンテキスト変数を更新
    updateSearchContext(hasValidSearchText);

    // 選択テキストが空の場合は早期リターン
    if (!searchText || searchText.trim() === "") {
        provider.refresh([]);
        return;
    }

    // 結果が取得できた後に、スクロールバーにハイライトを表示
    if (results.length > 0) {
        highlightAllOccurrencesInScrollbar(editor, results);
    }

    // グローバルステートに保存（アクセサーメソッドを使用）
    provider.saveSearchHistory();

    // 検索履歴ノードを更新
    provider.updateSearchHistoryNode();

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
            };

            let match;
            searchRegex.lastIndex = 0; // 正規表現のindexをリセット

            while ((match = searchRegex.exec(lineText)) !== null) {
                const startPos = new vscode.Position(i, match.index);

                results.push(
                    new TextOccurrence(
                        searchText,
                        lineText,
                        i,
                        match.index,
                        startPos,
                        document
                    )
                );
            }
        }

        // 検索結果が0件の場合はメッセージを表示
        if (results.length === 0) {
            // メッセージテキスト
            const messageText = l10n.t("No results found for: {0}", searchText);

            // メッセージノードを作成
            const noResultsNode = new TreeNode(
                messageText,
                vscode.TreeItemCollapsibleState.None
            );

            // アイコンを設定
            noResultsNode.iconPath = new vscode.ThemeIcon("info");

            // ツールチップを設定
            noResultsNode.tooltip = l10n.t("No items matching \"{0}\" were found. Right-click to copy this message.", searchText);

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

        // 以前の選択状態を復元する処理を追加
        if (prevSelection) {
            // 前の選択に一致する新しいノードを探す
            restoreSelection(organizedResults, prevSelection);
        }

        // 検索結果をプロバイダーに通知
        provider.refresh(organizedResults);
    } catch (error) {
        console.error("Error in findOccurrencesInStructure:", error);
        vscode.window.showErrorMessage(`Error finding occurrences: ${error}`);
    }
}

// 選択状態を復元するためのヘルパー関数
function restoreSelection(nodes: TreeNode[], prevSelection: TextOccurrence): boolean {
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
function clearSearch(rangeNavigatorProvider: RangeNavigatorProvider, editor?: vscode.TextEditor): void {
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

export function deactivate() {
    if (highlightDecorationType) {
        highlightDecorationType.dispose();
    }
}
