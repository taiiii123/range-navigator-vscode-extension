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
exports.initializeHighlightDecorations = initializeHighlightDecorations;
exports.clearHighlights = clearHighlights;
exports.highlightSelectedLine = highlightSelectedLine;
exports.highlightSelection = highlightSelection;
exports.highlightAllOccurrencesInScrollbar = highlightAllOccurrencesInScrollbar;
exports.disposeDecorations = disposeDecorations;
exports.getHighlightDecorationType = getHighlightDecorationType;
exports.getSelectionHighlightDecorationType = getSelectionHighlightDecorationType;
exports.getCurrentHighlightRange = getCurrentHighlightRange;
exports.getCurrentHighlightLineContent = getCurrentHighlightLineContent;
const vscode = __importStar(require("vscode"));
// グローバル変数としてデコレーションタイプを宣言
let highlightDecorationType;
let selectionHighlightDecorationType;
// 現在のハイライト範囲を記録するグローバル変数と、そのハイライトのテキスト内容を保存
let currentHighlightRange = null;
let currentHighlightLineContent = null;
/**
 * ハイライトデコレーションの初期化
 * 設定から色情報を取得してデコレーションタイプを作成
 */
function initializeHighlightDecorations() {
    // 設定から色情報を取得
    const config = vscode.workspace.getConfiguration('rangeNavigator');
    const backgroundColor = config.get('highlight.backgroundColor', 'rgba(255, 165, 0, 0.3)');
    const borderColor = config.get('highlight.borderColor', 'rgba(255, 140, 0, 0.8)');
    const scrollbarColor = config.get('highlight.scrollbarColor', 'rgba(255, 165, 0, 0.7)');
    // 行ハイライト用のデコレーションタイプ
    highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        border: '1px solid',
        borderColor: borderColor,
        isWholeLine: true,
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode.OverviewRulerLane.Center
    });
    // 選択範囲ハイライト用のデコレーションタイプ
    selectionHighlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: backgroundColor,
        border: '1px solid',
        borderColor: borderColor,
        isWholeLine: false,
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode.OverviewRulerLane.Right
    });
}
/**
 * ハイライトをクリアする関数
 * @param editor エディター
 */
function clearHighlights(editor) {
    // 行ハイライトをクリア
    editor.setDecorations(highlightDecorationType, []);
    // 選択範囲ハイライトもクリア
    editor.setDecorations(selectionHighlightDecorationType, []);
    // ハイライト情報をリセット
    currentHighlightRange = null;
    currentHighlightLineContent = null;
}
/**
 * 指定された行をハイライトする関数
 * @param editor エディター
 * @param range ハイライト範囲
 */
function highlightSelectedLine(editor, range) {
    clearHighlights(editor);
    editor.setDecorations(highlightDecorationType, [range]);
    // 現在のハイライト範囲とその行の内容を保存
    currentHighlightRange = range;
    currentHighlightLineContent = editor.document.lineAt(range.start.line).text;
}
/**
 * 選択範囲をハイライトする関数
 * @param editor エディター
 * @param range ハイライト範囲
 */
function highlightSelection(editor, range) {
    // 既存のハイライトを保持したまま、選択範囲のハイライトを適用
    editor.setDecorations(selectionHighlightDecorationType, [range]);
    console.log(`Highlighting selection from line ${range.start.line + 1}:${range.start.character} to line ${range.end.line + 1}:${range.end.character}`);
}
/**
 * 検索結果の全出現箇所をスクロールバーに表示する関数
 * @param editor エディター
 * @param occurrences 出現箇所の配列
 */
function highlightAllOccurrencesInScrollbar(editor, occurrences) {
    // 設定から色を読み込む
    const config = vscode.workspace.getConfiguration('rangeNavigator');
    const scrollbarColor = config.get('highlight.scrollbarColor', 'rgba(255, 165, 0, 0.7)');
    // 出現箇所の範囲を収集
    const ranges = occurrences.map(occurrence => {
        return new vscode.Range(occurrence.lineNumber, occurrence.startIndex, occurrence.lineNumber, occurrence.startIndex + occurrence.searchText.length);
    });
    // スクロールバーハイライト用のデコレーションタイプ
    const scrollbarDecorationType = vscode.window.createTextEditorDecorationType({
        overviewRulerColor: scrollbarColor,
        overviewRulerLane: vscode.OverviewRulerLane.Center
    });
    // スクロールバーにハイライトを適用
    editor.setDecorations(scrollbarDecorationType, ranges);
}
/**
 * デコレーションタイプを破棄する
 */
function disposeDecorations() {
    if (highlightDecorationType) {
        highlightDecorationType.dispose();
    }
    if (selectionHighlightDecorationType) {
        selectionHighlightDecorationType.dispose();
    }
}
/**
 * ハイライトデコレーションタイプのゲッター
 */
function getHighlightDecorationType() {
    return highlightDecorationType;
}
/**
 * 選択範囲ハイライトデコレーションタイプのゲッター
 */
function getSelectionHighlightDecorationType() {
    return selectionHighlightDecorationType;
}
/**
 * 現在のハイライト範囲のゲッター
 */
function getCurrentHighlightRange() {
    return currentHighlightRange;
}
/**
 * 現在のハイライト行内容のゲッター
 */
function getCurrentHighlightLineContent() {
    return currentHighlightLineContent;
}
//# sourceMappingURL=highlightUtils.js.map