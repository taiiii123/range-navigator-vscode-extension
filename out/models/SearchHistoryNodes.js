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
exports.SearchHistoryItemNode = exports.SearchHistoryNode = void 0;
const vscode = __importStar(require("vscode"));
const vscode_1 = require("vscode");
const TreeNode_1 = require("./TreeNode");
/**
 * 検索履歴の表示用ノード
 * 検索履歴のルートノードを表現
 */
class SearchHistoryNode extends TreeNode_1.TreeNode {
    constructor() {
        const historyTitle = vscode_1.l10n.t('Line Search History');
        super(historyTitle, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon("history");
        this.tooltip = vscode_1.l10n.t('View and reuse past searches');
        this.contextValue = 'searchHistoryRoot';
    }
}
exports.SearchHistoryNode = SearchHistoryNode;
/**
 * 個々の検索履歴項目
 * 履歴内の各検索項目を表示するノード
 */
class SearchHistoryItemNode extends TreeNode_1.TreeNode {
    historyItem;
    isSearchHistoryMode;
    _isSelected = false;
    /**
     * コンストラクタ
     * @param historyItem 履歴アイテム
     * @param isSearchHistoryMode 検索履歴モードかどうか
     */
    constructor(historyItem, isSearchHistoryMode = false) {
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
        const textAfter = lineText.substring(startIndex + searchText.length, Math.min(lineText.length, startIndex + searchText.length + contextAfter));
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
        super(label, vscode.TreeItemCollapsibleState.None);
        this.historyItem = historyItem;
        this.isSearchHistoryMode = isSearchHistoryMode;
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
    /**
     * 選択状態を設定するメソッド
     */
    set isSelected(value) {
        this._isSelected = value;
        this.updateIcon();
        // ラベルの更新
        this.updateLabel();
    }
    /**
     * 選択状態を取得するメソッド
     */
    get isSelected() {
        return this._isSelected;
    }
    /**
     * アイコンを更新するメソッド
     */
    updateIcon() {
        // 検索履歴モードではチェックマークアイコンを表示せず、常に検索アイコンを表示
        if (this.isSearchHistoryMode) {
            this.iconPath = new vscode.ThemeIcon("search");
        }
        else {
            // 通常モードでは選択状態に応じてアイコンを変更
            if (this._isSelected) {
                this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("terminal.ansiGreen"));
            }
            else {
                this.iconPath = new vscode.ThemeIcon("search");
            }
        }
    }
    /**
     * ラベルを更新するメソッド - TextOccurrence クラスと同様の処理にする
     */
    updateLabel() {
        // ラベルがオブジェクトの場合の処理
        if (typeof this.label === 'object' && this.label.label) {
            const currentLabel = this.label.label;
            const highlights = this.label.highlights || [];
            // 検索履歴モードでは選択マーカーを表示しない
            if (this.isSearchHistoryMode) {
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
    /**
     * 検索履歴モード設定メソッド
     * @param mode 設定するモード
     */
    setSearchHistoryMode(mode) {
        this.isSearchHistoryMode = mode;
        this.updateIcon();
        this.updateLabel();
    }
}
exports.SearchHistoryItemNode = SearchHistoryItemNode;
//# sourceMappingURL=SearchHistoryNodes.js.map