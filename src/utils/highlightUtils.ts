import * as vscode from 'vscode';

// グローバル変数としてデコレーションタイプを宣言
let highlightDecorationType: vscode.TextEditorDecorationType;
let selectionHighlightDecorationType: vscode.TextEditorDecorationType;

// 現在のハイライト範囲を記録するグローバル変数と、そのハイライトのテキスト内容を保存
let currentHighlightRange: vscode.Range | null = null;
let currentHighlightLineContent: string | null = null;

/**
 * ハイライトデコレーションの初期化
 * 設定から色情報を取得してデコレーションタイプを作成
 */
export function initializeHighlightDecorations(): void {
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
export function clearHighlights(editor: vscode.TextEditor): void {
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
export function highlightSelectedLine(editor: vscode.TextEditor, range: vscode.Range): void {
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
export function highlightSelection(editor: vscode.TextEditor, range: vscode.Range): void {
    // 既存のハイライトを保持したまま、選択範囲のハイライトを適用
    editor.setDecorations(selectionHighlightDecorationType, [range]);
    console.log(`Highlighting selection from line ${range.start.line + 1}:${range.start.character} to line ${range.end.line + 1}:${range.end.character}`);
}

/**
 * 検索結果の全出現箇所をスクロールバーに表示する関数
 * @param editor エディター
 * @param occurrences 出現箇所の配列
 */
export function highlightAllOccurrencesInScrollbar(editor: vscode.TextEditor, occurrences: any[]): void {
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

/**
 * デコレーションタイプを破棄する
 */
export function disposeDecorations(): void {
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
export function getHighlightDecorationType(): vscode.TextEditorDecorationType {
    return highlightDecorationType;
}

/**
 * 選択範囲ハイライトデコレーションタイプのゲッター
 */
export function getSelectionHighlightDecorationType(): vscode.TextEditorDecorationType {
    return selectionHighlightDecorationType;
}

/**
 * 現在のハイライト範囲のゲッター
 */
export function getCurrentHighlightRange(): vscode.Range | null {
    return currentHighlightRange;
}

/**
 * 現在のハイライト行内容のゲッター
 */
export function getCurrentHighlightLineContent(): string | null {
    return currentHighlightLineContent;
}
