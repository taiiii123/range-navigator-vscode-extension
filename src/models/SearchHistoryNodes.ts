import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { TreeNode } from './TreeNode';
import { HistoryItem } from './HistoryItem';

/**
 * 検索履歴の表示用ノード
 * 検索履歴のルートノードを表現
 */
export class SearchHistoryNode extends TreeNode {
    constructor() {
        const historyTitle = l10n.t('Line Search History');

        super(historyTitle, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon("history");
        this.tooltip = l10n.t('View and reuse past searches');
        this.contextValue = 'searchHistoryRoot';
    }
}

/**
 * 個々の検索履歴項目
 * 履歴内の各検索項目を表示するノード
 */
export class SearchHistoryItemNode extends TreeNode {
    private _isSelected: boolean = false;

    /**
     * コンストラクタ
     * @param historyItem 履歴アイテム
     * @param isSearchHistoryMode 検索履歴モードかどうか
     */
    constructor(
        public readonly historyItem: HistoryItem,
        private isSearchHistoryMode: boolean = false
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

    /**
     * 選択状態を設定するメソッド
     */
    public set isSelected(value: boolean) {
        this._isSelected = value;
        this.updateIcon();
        // ラベルの更新
        this.updateLabel();
    }

    /**
     * 選択状態を取得するメソッド
     */
    public get isSelected(): boolean {
        return this._isSelected;
    }

    /**
     * アイコンを更新するメソッド
     */
    private updateIcon() {
        // 検索履歴モードではチェックマークアイコンを表示せず、常に検索アイコンを表示
        if (this.isSearchHistoryMode) {
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

    /**
     * ラベルを更新するメソッド - TextOccurrence クラスと同様の処理にする
     */
    private updateLabel() {
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

    /**
     * 検索履歴モード設定メソッド
     * @param mode 設定するモード
     */
    public setSearchHistoryMode(mode: boolean): void {
        this.isSearchHistoryMode = mode;
        this.updateIcon();
        this.updateLabel();
    }
}
