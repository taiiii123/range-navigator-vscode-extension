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
exports.RangeNavigatorProvider = void 0;
const vscode = __importStar(require("vscode"));
const WelcomeNodes_1 = require("../models/WelcomeNodes");
const SearchHistoryNodes_1 = require("../models/SearchHistoryNodes");
/**
 * Range Navigatorのツリービュープロバイダー
 * VSCodeのツリービューにデータを提供するクラス
 */
class RangeNavigatorProvider {
    context;
    isSearchHistoryMode;
    // ツリーデータ変更イベント
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    // ルートノード
    rootNodes = [];
    // 検索履歴ノード
    searchHistoryNode = null;
    /**
     * コンストラクタ
     * @param context 拡張機能のコンテキスト
     * @param isSearchHistoryMode 検索履歴モードかどうか
     */
    constructor(context, isSearchHistoryMode = false) {
        this.context = context;
        this.isSearchHistoryMode = isSearchHistoryMode;
        // 初期表示用のウェルカムメッセージを設定
        this.showWelcomeMessage();
    }
    /**
     * 特定のノードを更新するメソッド
     * @param node 更新するノード
     */
    refreshNode(node) {
        this._onDidChangeTreeData.fire(node);
    }
    /**
     * ツリーアイテムを取得するメソッド（TreeDataProviderインターフェース）
     * @param element 取得するエレメント
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * 子ノードを取得するメソッド（TreeDataProviderインターフェース）
     * @param element 親エレメント
     */
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.rootNodes);
        }
        return Promise.resolve(element.children);
    }
    /**
     * 親ノードを取得するメソッド（オプション）
     * @param element 子エレメント
     */
    getParent(element) {
        return element.parentNode;
    }
    /**
     * 検索履歴を保存するためのメソッド
     * @param searchHistory 保存する検索履歴
     */
    saveSearchHistory(searchHistory) {
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
    showWelcomeMessage() {
        // ウェルカムメッセージのルートノードを作成
        const welcomeNode = new WelcomeNodes_1.WelcomeMessageNode();
        const usageNode = new WelcomeNodes_1.UsageInfoNode();
        // 検索履歴ノードを初期化するが、通常モードでは表示しない
        this.searchHistoryNode = new SearchHistoryNodes_1.SearchHistoryNode();
        this.updateSearchHistoryNode([]);
        // 検索履歴モードの場合のみ表示、通常モードでは追加しない
        if (this.isSearchHistoryMode) {
            this.rootNodes = [this.searchHistoryNode];
        }
        else {
            this.rootNodes = [welcomeNode, usageNode];
        }
        this._onDidChangeTreeData.fire();
    }
    /**
     * 検索履歴ノードを更新する
     * @param searchHistory 更新する検索履歴
     */
    updateSearchHistoryNode(searchHistory) {
        if (!this.searchHistoryNode) {
            this.searchHistoryNode = new SearchHistoryNodes_1.SearchHistoryNode();
        }
        // 既存の子ノードをクリア
        this.searchHistoryNode.children = [];
        // 検索履歴から子ノードを追加
        for (const item of searchHistory) {
            const historyItem = new SearchHistoryNodes_1.SearchHistoryItemNode(item, this.isSearchHistoryMode);
            this.searchHistoryNode.addChild(historyItem);
        }
    }
    /**
     * 検索履歴モードの設定
     * @param mode 設定するモード
     */
    setSearchHistoryMode(mode) {
        this.isSearchHistoryMode = mode;
        // 子ノードにもモード変更を伝播
        if (this.searchHistoryNode) {
            for (const child of this.searchHistoryNode.children) {
                if (child instanceof SearchHistoryNodes_1.SearchHistoryItemNode) {
                    child.setSearchHistoryMode(mode);
                }
            }
        }
    }
    /**
     * ツリーのルートノードを更新
     * @param rootNodes 新しいルートノード
     */
    refresh(rootNodes) {
        // 検索履歴モードの場合
        if (this.isSearchHistoryMode) {
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
exports.RangeNavigatorProvider = RangeNavigatorProvider;
//# sourceMappingURL=RangeNavigatorProvider.js.map