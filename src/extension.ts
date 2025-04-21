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
        const historyTitle = l10n.t('検索履歴:');

        super(historyTitle, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon("history");
        this.tooltip = l10n.t('過去の検索を表示して再利用');
        this.contextValue = 'searchHistoryRoot';
    }
}

// 個々の検索履歴項目
class SearchHistoryItemNode extends TreeNode {
    constructor(
        public readonly historyItem: HistoryItem
    ) {
        // 検索テキストと行番号を表示
        const lineNumber = historyItem.occurrenceInfo.lineNumber + 1;
        const label = l10n.t('行 {0}: "{1}"', lineNumber, historyItem.searchText);

        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon("search");
        this.tooltip = historyItem.occurrenceInfo.lineText.trim();
        this.contextValue = 'searchHistoryItem';

        // クリックで行にジャンプするコマンドを設定
        this.command = {
            title: "Go to Line",
            command: "rangeNavigator.gotoHistoryLine",
            arguments: [historyItem]
        };
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
    private highlightInfo: { fullText: string; highlights: [number, number][] };

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
        const textBefore = lineText.substring(startPos, startIndex);
        const highlightedText = lineText.substring(startIndex, startIndex + searchText.length);
        const textAfter = lineText.substring(
            startIndex + searchText.length,
            Math.min(lineText.length, startIndex + searchText.length + contextAfter)
        );

        // 表示テキストを構築
        let linePrefix = l10n.t('Line {0}: ', lineNumber + 1);
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
        } as vscode.TreeItemLabel;

        this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));
        this.tooltip = lineText.trim();

        // コマンドが指定されていなければデフォルトコマンドを設定
        if (!command) {
            this.command = {
                title: "Go to Occurrence",
                command: "rangeNavigator.gotoOccurrence",
                arguments: [document.uri, position, this.lineRange, searchText.length],
            };
        } else {
            this.command = command;
        }
    }
}

class RangeNavigatorProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private rootNodes: TreeNode[] = [];
    private searchHistoryNode: SearchHistoryNode | null = null;

    constructor(private context: vscode.ExtensionContext) {
        // 初期表示用のウェルカムメッセージを設定
        this.showWelcomeMessage();
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

        const range = new vscode.Range(startPos, endPos);
        structures.push(new CodeStructureNode(match[1], 'class', range, document));
    }

    // 関数を検索
    while ((match = functionPattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const funcEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
        const endPos = funcEndIndex !== -1 ? document.positionAt(funcEndIndex) : document.positionAt(text.length);

        const range = new vscode.Range(startPos, endPos);
        structures.push(new CodeStructureNode(match[1], 'function', range, document));
    }

    // メソッドを検索（簡易的な実装）
    while ((match = methodPattern.exec(text)) !== null) {
        // クラス内のメソッドか確認（簡易的）
        let isClassMethod = false;
        let parentClass: CodeStructureNode | undefined;

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

            const range = new vscode.Range(startPos, endPos);
            const methodNode = new CodeStructureNode(match[1], 'method', range, document);

            // メソッドをクラスの子ノードとして追加
            parentClass.addChild(methodNode);
        }
    }

    return structures;
}

// 対応する閉じ括弧を見つける簡易的な関数
function findMatchingBrace(text: string, startOffset: number): number {
    let braceCount = 0;
    let inBraces = false;

    for (let i = startOffset; i < text.length; i++) {
        const char = text[i];

        if (char === '{') {
            braceCount++;
            inBraces = true;
        } else if (char === '}') {
            braceCount--;
            if (inBraces && braceCount === 0) {
                return i + 1; // 閉じ括弧の次の位置
            }
        }
    }

    return -1; // 対応する閉じ括弧が見つからない
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
        const newNode = new CodeStructureNode(
            structure.name,
            structure.type,
            structure.range,
            document
        );

        // 子ノードを再帰的に処理
        for (const child of structure.children) {
            if (child instanceof CodeStructureNode) {
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
            };
        }

        // どの構造にも属さない場合は「その他」に分類
        if (!matched) {
            uncategorizedNode.addChild(occurrence);
            hasUncategorized = true;
        }
    }

    // 子ノードを持たない構造ノードを削除
    const filteredRootNodes = rootNodes.filter(node => node.children.length > 0);

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

    // 未分類の出現箇所があれば追加とカウント表示
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
        isWholeLine: true
    });

    const rangeNavigatorProvider = new RangeNavigatorProvider(context);
    const treeView = vscode.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: false,
    });

    // 履歴から行に移動するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('rangeNavigator.gotoHistoryLine',
            async (historyItem: HistoryItem) => {
                const docUri = historyItem.occurrenceInfo.documentUri;
                const position = historyItem.occurrenceInfo.position;
                const lineNumber = historyItem.occurrenceInfo.lineNumber;
                const searchText = historyItem.searchText;
                const searchTextLength = historyItem.occurrenceInfo.searchTextLength;

                // サイドバーからのナビゲーションフラグを設定
                isNavigatingFromSidebar = true;

                try {
                    // ドキュメントを開く
                    const editor = await vscode.window.showTextDocument(docUri);
                    const document = editor.document;

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
                            highlightSelectedLine(editor, lineRange);
                            // 操作完了後にフラグをリセット
                            setTimeout(() => {
                                isNavigatingFromSidebar = false;
                            }, 300);
                        }, 100);

                        // 最後に検索したテキストを更新
                        lastSearchedText = searchText;
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

                        // 操作完了後にフラグをリセット
                        setTimeout(() => {
                            isNavigatingFromSidebar = false;
                        }, 300);

                        // 検索テキストが見つからない旨をメッセージ表示
                        vscode.window.showInformationMessage(
                            l10n.t('検索テキスト "{0}" は現在の行に含まれていません。', searchText)
                        );
                    }
                } catch (error) {
                    console.error("Error navigating to history line:", error);
                    vscode.window.showErrorMessage(l10n.t('履歴行への移動中にエラーが発生しました。'));
                    isNavigatingFromSidebar = false;
                }
            }
        )
    );

    // 検索履歴を表示するコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand('range-navigator.showSearchHistory', () => {
            isSearchHistoryMode = !isSearchHistoryMode;

            // コンテキスト変数を設定してUI表示を切り替え
            vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', isSearchHistoryMode);

            // 検索履歴モードに応じてツリービューを更新
            if (isSearchHistoryMode) {
                // 検索履歴のみを表示
                showSearchHistoryOnly(rangeNavigatorProvider);
            } else {
                // 通常表示に戻す
                if (lastSearchedText) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        findOccurrencesInStructure(editor, lastSearchedText, rangeNavigatorProvider);
                    }
                } else {
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
                    return vscode.window.showWarningMessage(l10n.t('アクティブなエディタが見つかりません。'));
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
            // ツリービューを更新
            if (rangeNavigatorProvider instanceof RangeNavigatorProvider) {
                rangeNavigatorProvider.updateSearchHistoryNode();
                rangeNavigatorProvider.refresh(rangeNavigatorProvider['rootNodes']);
            }
            vscode.window.showInformationMessage(l10n.t('検索履歴をクリアしました。'));
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
            (docUri: vscode.Uri, position: vscode.Position, range: vscode.Range, searchTextLength: number) => {
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
                        highlightSelectedLine(editor, range);
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
            if (editor && treeView.visible && event.document === editor.document && lastSearchedText) {
                // 少し遅延させて検索結果を更新（連続変更時のパフォーマンス向上）
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

    // 検索履歴を更新
    for (const item of searchHistory) {
        const historyItem = new SearchHistoryItemNode(item);
        historyNode.addChild(historyItem);
    }

    // 見出し表示を変更
    historyNode.label = l10n.t('検索履歴');

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
}

// 指定された行をハイライトする関数
function highlightSelectedLine(editor: vscode.TextEditor, range: vscode.Range) {
    clearHighlights(editor);
    editor.setDecorations(highlightDecorationType, [range]);
    console.log(`Highlighting line ${range.start.line + 1}`);
}

// 指定されたテキストの出現箇所をすべて検索し、コード構造と関連付ける
function updateSearchContext(hasSearchText: boolean): void {
    vscode.commands.executeCommand('setContext', 'lastSearchedText', hasSearchText);
}

// findOccurrencesInStructure関数内の修正
async function findOccurrencesInStructure(
    editor: vscode.TextEditor,
    searchText: string,
    provider: RangeNavigatorProvider
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

    if (document.lineCount > 0) {
        // 検索テキストの最初の出現位置を探す
        let firstOccurrence: OccurrenceInfo | null = null;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            const index = lineText.indexOf(searchText);

            if (index !== -1) {
                const position = new vscode.Position(i, index);
                firstOccurrence = {
                    documentUri: document.uri,
                    lineNumber: i,
                    lineText: lineText,
                    position: position,
                    searchText: searchText,
                    searchTextLength: searchText.length
                };
                break;
            }
        }

        // 出現位置があれば履歴に追加
        if (firstOccurrence) {
            addToLineHistory(searchText, firstOccurrence, provider);
        }
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

        // 検索結果をプロバイダーに通知
        provider.refresh(organizedResults);
    } catch (error) {
        console.error("Error in findOccurrencesInStructure:", error);
        vscode.window.showErrorMessage(`Error finding occurrences: ${error}`);
    }
}

// クリア機能を実装する関数
function clearSearch(rangeNavigatorProvider: RangeNavigatorProvider, editor?: vscode.TextEditor): void {
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
