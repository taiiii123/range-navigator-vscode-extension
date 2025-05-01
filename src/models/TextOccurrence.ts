import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { TreeNode } from './TreeNode';

/**
 * テキスト出現箇所を表すノードクラス
 * 検索結果の各出現箇所を表現し、ハイライト表示や選択状態を管理する
 */
export class TextOccurrence extends TreeNode {
    // ハイライト用の行範囲
    public readonly lineRange: vscode.Range;

    // ハイライト情報
    private highlightInfo: { fullText: string; highlights: [number, number][] } = {
        fullText: "",
        highlights: [[0, 0]]
    };

    // 選択状態
    private _isSelected: boolean = false;

    // テキスト表示のための前後コンテキスト
    private textBefore: string = "";
    private highlightedText: string = "";
    private textAfter: string = "";

    /**
     * コンストラクタ
     * @param searchText 検索されたテキスト
     * @param lineText 行の全テキスト
     * @param lineNumber 行番号
     * @param startIndex 検索テキストの開始位置
     * @param position 検索テキストの位置
     * @param document 関連するテキストドキュメント
     * @param command オプションのコマンド
     */
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

    /**
     * 選択状態を設定するメソッド
     */
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

    /**
     * 選択状態を取得するメソッド
     */
    public get isSelected(): boolean {
        return this._isSelected;
    }

    /**
     * ラベルを更新するメソッド
     * 選択状態やハイライト位置に応じてラベル表示を調整
     */
    private updateLabel(): void {
        // 行番号プレフィックス
        const linePrefix = l10n.t('Line {0}: ', this.lineNumber + 1);

        // 選択中の場合、特別なマーカーを追加
        const marker = this._isSelected ? '➤ ' : '';
        const fullText = `${marker}${linePrefix}${this.textBefore}${this.highlightedText}${this.textAfter}`;

        // ハイライト位置を調整（マーカーの有無によって調整）
        const markerLength = this._isSelected ? 2 : 0;
        const prefixLength = linePrefix.length;
        const highlightStart = markerLength + prefixLength + this.textBefore.length;
        const highlightEnd = highlightStart + this.highlightedText.length;

        // ハイライト情報を更新
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
