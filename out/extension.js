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
const vscode_1 = require("vscode");
const HistoryItem_1 = require("./models/HistoryItem");
const TreeNode_1 = require("./models/TreeNode");
const SearchHistoryNodes_1 = require("./models/SearchHistoryNodes");
const RangeNavigatorProvider_1 = require("./providers/RangeNavigatorProvider");
const highlightUtils_1 = require("./utils/highlightUtils");
const searchUtils_1 = require("./utils/searchUtils");
// グローバル変数
let lastSearchedText = '';
let isNavigatingFromSidebar = false;
let hasShownWelcomeMessage = false;
let searchHistory = [];
let isSearchHistoryMode = false;
let selectedOccurrence = null;
/**
 * 拡張機能のアクティベーション
 * @param context 拡張機能のコンテキスト
 */
function activate(context) {
    console.log("Activating Range Navigator extension");
    // ハイライトの初期化
    (0, highlightUtils_1.initializeHighlightDecorations)();
    // 拡張機能のコンテキストから検索履歴を読み込む
    loadSearchHistory(context);
    // コンテキスト変数を初期化
    (0, searchUtils_1.updateSearchContext)(false);
    // 設定が変更された場合にウィンドウをリロードするためのイベントリスナーを登録
    registerConfigurationChangeListener(context);
    // プロバイダーとツリービューの初期化
    const rangeNavigatorProvider = new RangeNavigatorProvider_1.RangeNavigatorProvider(context, isSearchHistoryMode);
    const treeView = vscode.window.createTreeView("rangeNavigatorView", {
        treeDataProvider: rangeNavigatorProvider,
        showCollapseAll: false,
    });
    // 各種コマンドの登録
    registerCommands(context, rangeNavigatorProvider, treeView);
    // イベントリスナーの登録
    registerEventListeners(context, rangeNavigatorProvider, treeView);
}
/**
 * 設定変更イベントリスナーの登録
 * @param context 拡張機能のコンテキスト
 */
function registerConfigurationChangeListener(context) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('rangeNavigator.highlight.backgroundColor')
            || e.affectsConfiguration('rangeNavigator.highlight.borderColor')
            || e.affectsConfiguration('rangeNavigator.highlight.scrollbarColor')
            || e.affectsConfiguration('rangeNavigator.enableNavigationOnClick')
            || e.affectsConfiguration('rangeNavigator.history.maxSize')
            || e.affectsConfiguration('rangeNavigator.autoShowSidebarOnSearch')) {
            const answer = await vscode.window.showInformationMessage(vscode_1.l10n.t("Range Navigator: Settings have been changed. A window reload is required to apply the changes. Do you want to reload now?"), vscode_1.l10n.t("Yes"), vscode_1.l10n.t("No"));
            if (answer === vscode_1.l10n.t("Yes")) {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    }));
}
/**
 * 全コマンドの登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 * @param treeView ツリービュー
 */
function registerCommands(context, provider, treeView) {
    // 履歴から行に移動するコマンド
    registerGotoHistoryLineCommand(context, provider);
    // 検索履歴を表示するコマンド
    registerShowSearchHistoryCommand(context, provider);
    // 履歴から再検索するコマンド
    registerSearchAgainCommand(context, provider);
    // 履歴をクリアするコマンド
    registerClearHistoryCommand(context, provider);
    // ツリービューを折りたたむコマンド
    registerCollapseAllCommand(context);
    // ツリービューを展開するコマンド
    registerExpandAllCommand(context, treeView, provider);
    // クリックされた行への移動とハイライト表示を行うコマンド
    registerGotoOccurrenceCommand(context, provider);
    // 定義位置に移動するコマンド
    registerGotoDefinitionCommand(context);
    // 検索をクリアするコマンド
    registerClearSearchCommand(context, provider);
    // 手動で検索を実行するコマンド
    registerFindOccurrencesCommand(context, provider, treeView);
    // メッセージをコピーするコマンド
    registerCopyMessageCommand(context);
    // ハイライトのみを削除するコマンド
    registerClearHighlightsOnlyCommand(context);
}
/**
 * イベントリスナーの登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 * @param treeView ツリービュー
 */
function registerEventListeners(context, provider, treeView) {
    // テキスト選択変更イベント
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((event) => {
        handleSelectionChange(event.textEditor, provider, treeView);
    }));
    // サイドバー表示状態変更イベント
    context.subscriptions.push(treeView.onDidChangeVisibility((event) => {
        handleTreeViewVisibilityChange(event, provider, treeView);
    }));
    // エディタ変更イベント
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        clearSearch(provider, editor);
    }));
    // テキスト変更イベント - 文書が変更されたときの処理
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        handleDocumentChange(event, provider, treeView);
    }));
    context.subscriptions.push(treeView);
}
/**
 * 検索履歴を読み込む関数
 * @param context 拡張機能のコンテキスト
 */
function loadSearchHistory(context) {
    const savedHistory = context.globalState.get('searchHistory', []);
    try {
        // 型が配列の場合のみ処理
        if (Array.isArray(savedHistory)) {
            // 保存された履歴を復元
            searchHistory = savedHistory.map(item => {
                if (item && typeof item === 'object' && 'documentUri' in item) {
                    // 新しいフォーマットの場合
                    const position = new vscode.Position(item.lineNumber, item.character);
                    const occurrenceInfo = {
                        documentUri: vscode.Uri.parse(item.documentUri),
                        lineNumber: item.lineNumber,
                        lineText: item.lineText || '',
                        position: position,
                        searchText: item.searchText,
                        searchTextLength: item.searchTextLength || item.searchText.length
                    };
                    return new HistoryItem_1.HistoryItem(item.searchText, occurrenceInfo);
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
}
/**
 * 履歴を追加する関数
 * @param searchText 検索テキスト
 * @param occurrenceInfo 出現位置情報
 * @param provider ツリービュープロバイダー
 */
function addToLineHistory(searchText, occurrenceInfo, provider) {
    // 設定から最大履歴数を取得
    const config = vscode.workspace.getConfiguration('rangeNavigator');
    const maxHistorySize = config.get('history.maxSize', 10);
    // 新しい履歴アイテムを作成
    const newItem = new HistoryItem_1.HistoryItem(searchText, occurrenceInfo);
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
    provider.saveSearchHistory(searchHistory);
    // 検索履歴ノードを更新
    provider.updateSearchHistoryNode(searchHistory);
}
/**
 * 検索履歴のみを表示する関数
 * @param provider ツリービュープロバイダー
 */
function showSearchHistoryOnly(provider) {
    // 検索履歴ノードのみを表示
    const historyNode = new SearchHistoryNodes_1.SearchHistoryNode();
    // 検索履歴がない場合の表示
    if (searchHistory.length === 0) {
        const emptyNode = new TreeNode_1.TreeNode(vscode_1.l10n.t('No history available.'), vscode.TreeItemCollapsibleState.None);
        emptyNode.iconPath = new vscode.ThemeIcon("info");
        historyNode.addChild(emptyNode);
    }
    else {
        // 検索履歴を更新（選択状態を常に非選択に設定）
        for (const item of searchHistory) {
            const historyItem = new SearchHistoryNodes_1.SearchHistoryItemNode(item, true);
            // 明示的に選択状態をfalseに設定する
            historyItem.isSelected = false;
            historyNode.addChild(historyItem);
        }
    }
    // 見出し表示を変更
    historyNode.label = vscode_1.l10n.t('Line Search History');
    // 検索履歴を常に展開表示
    historyNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    // ツリービューを更新（検索履歴ノードのみを表示）
    provider.refresh([historyNode]);
}
/**
 * すべて展開関数の定義
 * @param treeView ツリービュー
 * @param provider ツリービュープロバイダー
 */
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
/**
 * 選択変更ハンドラ
 * @param editor エディタ
 * @param provider ツリービュープロバイダー
 * @param treeView ツリービュー
 */
async function handleSelectionChange(editor, provider, treeView) {
    if (!editor) {
        return;
    }
    // 設定から自動サイドバー表示の有効/無効を取得
    const config = vscode.workspace.getConfiguration('rangeNavigator');
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
                    await vscode.commands.executeCommand('rangeNavigatorView.focus');
                }
                // 選択されたテキストを検索
                selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, selectedText, provider, null, selectedOccurrence);
            }
            else if (treeView.visible) {
                // 従来の動作：サイドバーが表示されている場合のみ検索を実行
                selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, selectedText, provider, null, selectedOccurrence);
            }
        }
    }
    else {
        // カーソル位置の変更だけの場合（範囲選択なし）
        // 選択範囲ハイライトはクリアするが、行ハイライトは保持
        editor.setDecorations((0, highlightUtils_1.getHighlightDecorationType)(), []);
        if (lastSearchedText) {
            // 何もしない - 行ハイライトと検索結果はそのまま表示
        }
        else {
            // 検索結果がない場合はウェルカムメッセージを表示
            (0, highlightUtils_1.clearHighlights)(editor);
            provider.showWelcomeMessage();
        }
    }
}
/**
 * ツリービュー表示状態変更ハンドラ
 * @param event イベント
 * @param provider ツリービュープロバイダー
 * @param treeView ツリービュー
 */
async function handleTreeViewVisibilityChange(event, provider, treeView) {
    if (event.visible) {
        // サイドバーが表示されたとき、アクティブエディタに最後の検索テキストがあればそれを使用
        const editor = vscode.window.activeTextEditor;
        if (editor && lastSearchedText) {
            selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, lastSearchedText, provider, null, selectedOccurrence);
        }
        else if (editor) {
            handleSelectionChange(editor, provider, treeView);
        }
        else {
            // エディタが開かれていない場合はウェルカムメッセージを表示
            provider.showWelcomeMessage();
        }
    }
    else if (vscode.window.activeTextEditor) {
        (0, highlightUtils_1.clearHighlights)(vscode.window.activeTextEditor);
    }
}
/**
 * ドキュメント変更ハンドラ
 * @param event イベント
 * @param provider ツリービュープロバイダー
 * @param treeView ツリービュー
 */
async function handleDocumentChange(event, provider, treeView) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || event.document !== editor.document) {
        return;
    }
    // ハイライトが存在する場合の処理
    const currentHighlightRange = (0, highlightUtils_1.getCurrentHighlightRange)();
    const currentHighlightLineContent = (0, highlightUtils_1.getCurrentHighlightLineContent)();
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
            const updatedRange = new vscode.Range(foundLine, 0, foundLine, document.lineAt(foundLine).text.length);
            editor.setDecorations((0, highlightUtils_1.getHighlightDecorationType)(), [updatedRange]);
            // テキスト内容は変わっていないので更新不要
        }
        else {
            // ハイライト行が見つからない（削除された）場合はクリア
            (0, highlightUtils_1.clearHighlights)(editor);
        }
    }
    // 検索結果の更新処理
    if (treeView.visible && lastSearchedText) {
        setTimeout(async () => {
            selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, lastSearchedText, provider, null, selectedOccurrence);
        }, 500);
    }
}
/**
 * クリア機能を実装する関数
 * @param rangeNavigatorProvider ツリービュープロバイダー
 * @param editor エディタ
 */
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
    (0, searchUtils_1.updateSearchContext)(false);
    // エディタがある場合はハイライトをクリア
    if (editor) {
        (0, highlightUtils_1.clearHighlights)(editor);
    }
    // ウェルカムメッセージを表示
    rangeNavigatorProvider.showWelcomeMessage();
}
/**
 * 履歴から行に移動するコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 */
function registerGotoHistoryLineCommand(context, provider) {
    context.subscriptions.push(vscode.commands.registerCommand('rangeNavigator.gotoHistoryLine', async (historyItem, historyItemNode) => {
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
            provider.saveSearchHistory(searchHistory);
            // 検索履歴ノードを更新
            provider.updateSearchHistoryNode(searchHistory);
        }
        // 検索履歴モードの場合は通常モードに切り替える
        if (isSearchHistoryMode) {
            isSearchHistoryMode = false;
            provider.setSearchHistoryMode(false);
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
                    editor.revealRange(new vscode.Range(currentPosition, selectionEnd), vscode.TextEditorRevealType.InCenter);
                    // 行ハイライトを適用
                    const lineRange = new vscode.Range(lineNumber, 0, lineNumber, currentLineText.length);
                    setTimeout(() => {
                        // ハイライト表示を維持
                        (0, highlightUtils_1.highlightSelectedLine)(editor, lineRange);
                        // 最後に検索したテキストを更新して通常モードで検索結果を表示
                        lastSearchedText = searchText;
                        // 操作完了後に通常モードで検索結果を表示し、選択状態を維持
                        (0, searchUtils_1.findOccurrencesInStructure)(editor, searchText, provider)
                            .then(() => {
                            // 検索結果が表示された後、該当行を選択状態にする
                            setTimeout(() => {
                                // 行に対応するTextOccurrenceを見つけて選択状態にする処理
                                selectedOccurrence = (0, searchUtils_1.updateOccurrenceSelection)(provider, lineNumber, currentIndex, searchText, selectedOccurrence);
                                // フラグをリセット
                                isNavigatingFromSidebar = false;
                            }, 300);
                        });
                    }, 100);
                }
                else {
                    // 検索テキストが行にない場合はカーソル位置だけ移動
                    const linePosition = new vscode.Position(lineNumber, 0);
                    editor.selection = new vscode.Selection(linePosition, linePosition);
                    // 見やすいようにスクロール位置を調整
                    editor.revealRange(new vscode.Range(linePosition, linePosition), vscode.TextEditorRevealType.InCenter);
                    // ハイライトは行わないが、最後に検索したテキストを更新
                    lastSearchedText = searchText;
                    // 通常モードで検索結果を表示
                    (0, searchUtils_1.findOccurrencesInStructure)(editor, searchText, provider);
                    // 操作完了後にフラグをリセット
                    setTimeout(() => {
                        isNavigatingFromSidebar = false;
                    }, 300);
                    // 検索テキストが見つからない旨をメッセージ表示
                    vscode.window.showInformationMessage(vscode_1.l10n.t('The search text {0} is not found in the current line.', searchText));
                }
            }
            else {
                // 無効な行番号の場合
                vscode.window.showWarningMessage(vscode_1.l10n.t('The specified line number {0} is outside the document range.', lineNumber + 1));
                isNavigatingFromSidebar = false;
            }
        }
        catch (error) {
            console.error("Error navigating to history line:", error);
            vscode.window.showErrorMessage(vscode_1.l10n.t('Error navigating to history line.'));
            isNavigatingFromSidebar = false;
        }
    }));
}
/**
 * 検索履歴を表示するコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 */
function registerShowSearchHistoryCommand(context, provider) {
    context.subscriptions.push(vscode.commands.registerCommand('range-navigator.showSearchHistory', () => {
        // 検索履歴モードでない場合（通常モードの場合）は、履歴を表示する
        if (!isSearchHistoryMode) {
            // 現在の選択状態を保存（モード切替前に保存することが重要）
            const currentSelection = selectedOccurrence;
            // 履歴モードに切り替え
            isSearchHistoryMode = true;
            provider.setSearchHistoryMode(true);
            vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', true);
            // 履歴モードに切り替える際は一時的に選択状態を解除するが、変数自体は保持
            if (selectedOccurrence) {
                // 選択状態を視覚的に解除するだけ
                selectedOccurrence.isSelected = false;
                provider.refreshNode(selectedOccurrence);
                // ここで selectedOccurrence 自体は null にしない
            }
            // 検索履歴のみを表示
            showSearchHistoryOnly(provider);
        }
        else {
            // 通常モードに切り替え
            isSearchHistoryMode = false;
            provider.setSearchHistoryMode(false);
            vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);
            // 通常モードに戻す
            if (lastSearchedText) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    // 最後の検索テキストを使用して検索結果を表示
                    (0, searchUtils_1.findOccurrencesInStructure)(editor, lastSearchedText, provider);
                }
            }
            else {
                // 検索テキストがない場合はウェルカムメッセージを表示
                provider.showWelcomeMessage();
            }
        }
    }));
}
/**
 * 履歴から再検索するコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 */
function registerSearchAgainCommand(context, provider) {
    context.subscriptions.push(vscode.commands.registerCommand('rangeNavigator.searchAgain', async (searchText) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return vscode.window.showWarningMessage(vscode_1.l10n.t('No active editor found.'));
        }
        // 検索履歴モードを解除
        isSearchHistoryMode = false;
        provider.setSearchHistoryMode(false);
        vscode.commands.executeCommand('setContext', 'rangeNavigator.historyMode', false);
        // 選択テキストを設定して検索を実行
        lastSearchedText = searchText;
        selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, searchText, provider);
    }));
}
/**
 * 履歴をクリアするコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 */
function registerClearHistoryCommand(context, provider) {
    context.subscriptions.push(vscode.commands.registerCommand('range-navigator.clearHistory', () => {
        // 履歴をクリア
        searchHistory = [];
        // グローバルステートを更新
        provider.saveSearchHistory(searchHistory);
        // 検索履歴ノードを更新
        provider.updateSearchHistoryNode(searchHistory);
        // 検索履歴モードの場合
        if (isSearchHistoryMode) {
            // 検索履歴ノードを空の状態で表示
            const emptyHistoryNode = new SearchHistoryNodes_1.SearchHistoryNode();
            emptyHistoryNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            provider.refresh([emptyHistoryNode]);
            showSearchHistoryOnly(provider);
        }
        else {
            // 通常モードの場合はウェルカムメッセージを表示
            provider.showWelcomeMessage();
        }
        vscode.window.showInformationMessage(vscode_1.l10n.t('Search history has been cleared.'));
    }));
}
/**
 * ツリービューを折りたたむコマンド登録
 * @param context 拡張機能のコンテキスト
 */
function registerCollapseAllCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand("range-navigator.collapseAll", () => {
        vscode.commands.executeCommand('workbench.actions.treeView.rangeNavigatorView.collapseAll');
    }));
}
/**
 * ツリービューを展開するコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param treeView ツリービュー
 * @param provider ツリービュープロバイダー
 */
function registerExpandAllCommand(context, treeView, provider) {
    context.subscriptions.push(vscode.commands.registerCommand("range-navigator.expandAll", () => {
        expandAll(treeView, provider);
    }));
}
/**
 * クリックされた行への移動とハイライト表示を行うコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 */
function registerGotoOccurrenceCommand(context, provider) {
    context.subscriptions.push(vscode.commands.registerCommand('rangeNavigator.gotoOccurrence', (docUri, position, range, searchTextLength, occurrence) => {
        // 前の選択をクリア
        if (selectedOccurrence && selectedOccurrence !== occurrence) {
            selectedOccurrence.isSelected = false;
            provider.refreshNode(selectedOccurrence);
        }
        // 新しい選択を設定
        selectedOccurrence = occurrence;
        occurrence.isSelected = true;
        provider.refreshNode(occurrence);
        // サイドバーからのナビゲーションフラグを設定
        isNavigatingFromSidebar = true;
        // クリックされた行への移動とハイライト表示を行うコマンド内
        vscode.window.showTextDocument(docUri).then(editor => {
            // 検索テキストの範囲全体を選択
            const selectionEnd = new vscode.Position(position.line, position.character + searchTextLength);
            const selectionRange = new vscode.Range(position, selectionEnd);
            editor.selection = new vscode.Selection(position, selectionEnd);
            // 見やすいようにスクロール位置を調整
            editor.revealRange(selectionRange, vscode.TextEditorRevealType.InCenter);
            // 行全体と選択範囲のハイライトを適用
            setTimeout(() => {
                // 現在の行の最新の範囲を取得
                const currentLine = editor.document.lineAt(position.line);
                const lineRange = new vscode.Range(position.line, 0, position.line, currentLine.text.length);
                // 行ハイライトを適用
                (0, highlightUtils_1.highlightSelectedLine)(editor, lineRange);
                // 選択範囲ハイライトを適用
                (0, highlightUtils_1.highlightSelection)(editor, selectionRange);
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
                addToLineHistory(searchText, occurrenceInfo, provider);
            }
        });
    }));
}
/**
 * 定義位置に移動するコマンド登録
 * @param context 拡張機能のコンテキスト
 */
function registerGotoDefinitionCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('rangeNavigator.gotoDefinition', (docUri, position, range) => {
        // サイドバーからのナビゲーションフラグを設定
        isNavigatingFromSidebar = true;
        vscode.window.showTextDocument(docUri).then(editor => {
            // カーソルを定義位置に移動
            editor.selection = new vscode.Selection(position, position);
            // 見やすいようにスクロール位置を調整
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            // 行ハイライトを適用
            setTimeout(() => {
                (0, highlightUtils_1.highlightSelectedLine)(editor, new vscode.Range(position.line, 0, position.line, editor.document.lineAt(position.line).text.length));
                // 操作完了後にフラグをリセット
                setTimeout(() => {
                    isNavigatingFromSidebar = false;
                }, 300);
            }, 100);
        });
    }));
}
/**
 * 検索をクリアするコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 */
function registerClearSearchCommand(context, provider) {
    context.subscriptions.push(vscode.commands.registerCommand('range-navigator.clearSearch', () => {
        const editor = vscode.window.activeTextEditor;
        clearSearch(provider, editor);
    }));
}
/**
 * 手動で検索を実行するコマンド登録
 * @param context 拡張機能のコンテキスト
 * @param provider ツリービュープロバイダー
 * @param treeView ツリービュー
 */
function registerFindOccurrencesCommand(context, provider, treeView) {
    context.subscriptions.push(vscode.commands.registerCommand('range-navigator.findOccurrences', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return vscode.window.showWarningMessage(vscode_1.l10n.t('No active editor found.'));
        }
        const selection = editor.selection;
        if (!selection.isEmpty) {
            const selectedText = editor.document.getText(selection);
            if (selectedText && selectedText.length > 0) {
                lastSearchedText = selectedText;
                selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, selectedText, provider, null, selectedOccurrence);
                // サイドバーを開く
                await vscode.commands.executeCommand('rangeNavigatorView.focus');
            }
        }
        else {
            // 選択がない場合は、ユーザーに検索テキストの入力を促す
            const searchText = await vscode.window.showInputBox({
                placeHolder: vscode_1.l10n.t('Enter text to search for'),
                prompt: vscode_1.l10n.t('Search for text in the current document')
            });
            if (searchText && searchText.length > 0) {
                lastSearchedText = searchText;
                selectedOccurrence = await (0, searchUtils_1.findOccurrencesInStructure)(editor, searchText, provider, null, selectedOccurrence);
                // サイドバーを開く
                await vscode.commands.executeCommand('rangeNavigatorView.focus');
            }
        }
    }));
}
/**
 * メッセージをコピーするコマンド登録
 * @param context 拡張機能のコンテキスト
 */
function registerCopyMessageCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('range-navigator.copyMessage', async (node) => {
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
                await vscode.env.clipboard.writeText(messageText);
                vscode.window.showInformationMessage(vscode_1.l10n.t('Message copied to clipboard!'));
            }
        }
    }));
}
/**
 * ハイライトのみを削除するコマンド登録
 * @param context 拡張機能のコンテキスト
 */
function registerClearHighlightsOnlyCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('range-navigator.clearHighlightsOnly', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            (0, highlightUtils_1.clearHighlights)(editor);
        }
    }));
}
/**
 * 拡張機能の停止処理
 */
function deactivate() {
    (0, highlightUtils_1.disposeDecorations)();
}
//# sourceMappingURL=extension.js.map