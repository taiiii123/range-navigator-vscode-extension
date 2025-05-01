import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { TreeNode } from '../models/TreeNode';
import { WelcomeMessageNode, UsageInfoNode } from '../models/WelcomeNodes';
import { SearchHistoryNode, SearchHistoryItemNode } from '../models/SearchHistoryNodes';
import { HistoryItem } from '../models/HistoryItem';

/**
 * Range Navigatorのツリービュープロバイダー
 * VSCodeのツリービューにデータを提供するクラス
 */
export class RangeNavigatorProvider implements vscode.TreeDataProvider<TreeNode> {
    // ツリーデータ変更イベント
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // ルートノード
    private rootNodes: TreeNode[] = [];

    // 検索履歴ノード
    public searchHistoryNode: SearchHistoryNode | null = null;

    /**
     * コンストラクタ
     * @param context 拡張機能のコンテキスト
     * @param isSearchHistoryMode 検索履歴モードかどうか
     */
    constructor(
        private context: vscode.ExtensionContext,
        private isSearchHistoryMode: boolean = false
    ) {
        // 初期表示用のウェルカムメッセージを設定
        this.showWelcomeMessage();
    }

    /**
     * 特定のノードを更新するメソッド
     * @param node 更新するノード
     */
    public refreshNode(node: TreeNode): void {
        this._onDidChangeTreeData.fire(node);
    }

    /**
     * ツリーアイテムを取得するメソッド（TreeDataProviderインターフェース）
     * @param element 取得するエレメント
     */
    public getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    /**
     * 子ノードを取得するメソッド（TreeDataProviderインターフェース）
     * @param element 親エレメント
     */
    public getChildren(element?: TreeNode): Thenable<TreeNode[]> {
        if (!element) {
            return Promise.resolve(this.rootNodes);
        }
        return Promise.resolve(element.children);
    }

    /**
     * 親ノードを取得するメソッド（オプション）
     * @param element 子エレメント
     */
    public getParent(element: TreeNode): vscode.ProviderResult<TreeNode> {
        return element.parentNode;
    }

    /**
     * 検索履歴を保存するためのメソッド
     * @param searchHistory 保存する検索履歴
     */
    public saveSearchHistory(searchHistory: HistoryItem[]): void {
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

    /**
       * ウェルカムメッセージを表示
       */
    public showWelcomeMessage(): void {
        // ウェルカムメッセージのルートノードを作成
        const welcomeNode = new WelcomeMessageNode();
        const usageNode = new UsageInfoNode();

        // 検索履歴ノードを初期化するが、通常モードでは表示しない
        this.searchHistoryNode = new SearchHistoryNode();
        this.updateSearchHistoryNode([]);

        // 検索履歴モードの場合のみ表示、通常モードでは追加しない
        if (this.isSearchHistoryMode) {
            this.rootNodes = [this.searchHistoryNode];
        } else {
            this.rootNodes = [welcomeNode, usageNode];
        }

        this._onDidChangeTreeData.fire();
    }

    /**
     * 検索履歴ノードを更新する
     * @param searchHistory 更新する検索履歴
     */
    public updateSearchHistoryNode(searchHistory: HistoryItem[]): void {
        if (!this.searchHistoryNode) {
            this.searchHistoryNode = new SearchHistoryNode();
        }

        // 既存の子ノードをクリア
        this.searchHistoryNode.children = [];

        // 検索履歴から子ノードを追加
        for (const item of searchHistory) {
            const historyItem = new SearchHistoryItemNode(item, this.isSearchHistoryMode);
            this.searchHistoryNode.addChild(historyItem);
        }
    }

    /**
     * 検索履歴モードの設定
     * @param mode 設定するモード
     */
    public setSearchHistoryMode(mode: boolean): void {
        this.isSearchHistoryMode = mode;

        // 子ノードにもモード変更を伝播
        if (this.searchHistoryNode) {
            for (const child of this.searchHistoryNode.children) {
                if (child instanceof SearchHistoryItemNode) {
                    child.setSearchHistoryMode(mode);
                }
            }
        }
    }

    /**
     * ツリーのルートノードを更新
     * @param rootNodes 新しいルートノード
     */
    public refresh(rootNodes: TreeNode[]): void {
        // 検索履歴モードの場合
        if (this.isSearchHistoryMode) {
            // 検索履歴モードでは、rootNodesをそのまま使用
            this.rootNodes = rootNodes;
        } else {
            // 通常モードでは検索履歴ノードを追加しない
            this.rootNodes = rootNodes;
        }

        this._onDidChangeTreeData.fire();
    }
}
