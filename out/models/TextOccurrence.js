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
exports.TextOccurrence = void 0;
const vscode = __importStar(require("vscode"));
const vscode_1 = require("vscode");
const TreeNode_1 = require("./TreeNode");
/**
 * テキスト出現箇所を表すノードクラス
 * 検索結果の各出現箇所を表現し、ハイライト表示や選択状態を管理する
 */
class TextOccurrence extends TreeNode_1.TreeNode {
    searchText;
    lineText;
    lineNumber;
    startIndex;
    position;
    document;
    // ハイライト用の行範囲
    lineRange;
    // ハイライト情報
    highlightInfo = {
        fullText: "",
        highlights: [[0, 0]]
    };
    // 選択状態
    _isSelected = false;
    // テキスト表示のための前後コンテキスト
    textBefore = "";
    highlightedText = "";
    textAfter = "";
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
    constructor(searchText, lineText, lineNumber, startIndex, position, document, command) {
        // TreeNodeの親クラスのコンストラクタにラベルを直接渡さない
        super("", vscode.TreeItemCollapsibleState.None);
        this.searchText = searchText;
        this.lineText = lineText;
        this.lineNumber = lineNumber;
        this.startIndex = startIndex;
        this.position = position;
        this.document = document;
        // 行全体の範囲を保存
        this.lineRange = new vscode.Range(lineNumber, 0, lineNumber, lineText.length);
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
        this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));
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
    /**
     * 選択状態を設定するメソッド
     */
    set isSelected(value) {
        this._isSelected = value;
        // 選択状態に応じてアイコンを変更
        if (this._isSelected) {
            this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("terminal.ansiGreen"));
        }
        else {
            this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));
        }
        // ラベルを更新
        this.updateLabel();
    }
    /**
     * 選択状態を取得するメソッド
     */
    get isSelected() {
        return this._isSelected;
    }
    /**
     * ラベルを更新するメソッド
     * 選択状態やハイライト位置に応じてラベル表示を調整
     */
    updateLabel() {
        // 行番号プレフィックス
        const linePrefix = vscode_1.l10n.t('Line {0}: ', this.lineNumber + 1);
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
        };
    }
}
exports.TextOccurrence = TextOccurrence;
//# sourceMappingURL=TextOccurrence.js.map