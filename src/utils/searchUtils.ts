import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { TextOccurrence } from '../models/TextOccurrence';
import { TreeNode } from '../models/TreeNode';
import { SUPPORTED_EXTENSIONS } from '../constants';
import { parseCodeStructure, organizeOccurrencesByStructure } from './codeParser';
import {
    highlightSelectedLine,
    highlightSelection,
    highlightAllOccurrencesInScrollbar,
    clearHighlights
} from './highlightUtils';

/**
 * 検索テキストの有無を追跡するコンテキスト変数の更新
 * @param hasSearchText 検索テキストの有無
 */
export function updateSearchContext(hasSearchText: boolean): void {
    vscode.commands.executeCommand('setContext', 'lastSearchedText', hasSearchText);
}

/**
 * 選択状態を復元するためのヘルパー関数
 * @param nodes ツリーノード
 * @param prevSelection 以前の選択
 * @returns 成功したかどうか
 */
export function restoreSelection(nodes: TreeNode[], prevSelection: TextOccurrence): boolean {
    // prevSelection が null の場合は早期リターン
    if (!prevSelection) {
        return false;
    }

    for (const node of nodes) {
        // TextOccurrence ノードの場合
        if (node instanceof TextOccurrence) {
            if (node.lineNumber === prevSelection.lineNumber &&
                node.startIndex === prevSelection.startIndex) {
                // 選択状態を復元
                node.isSelected = true;
                return true;
            }
        }

        // 子ノードに対して再帰的に処理
        if (node.children && node.children.length > 0) {
            if (restoreSelection(node.children, prevSelection)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * エディタの選択位置からサイドバーの対応項目を選択状態にする関数
 * @param editor エディタ
 * @param selection 選択範囲
 * @param provider プロバイダ
 * @param selectedOccurrence 現在選択中の出現箇所
 * @returns 新しく選択された出現箇所
 */
export function updateSidebarSelectionFromEditor(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    provider: any,
    selectedOccurrence: TextOccurrence | null
): TextOccurrence | null {
    // 前の選択をクリア
    if (selectedOccurrence) {
        selectedOccurrence.isSelected = false;
        provider.refreshNode(selectedOccurrence);
    }

    const selectedText = editor.document.getText(selection);
    const selectedLine = selection.start.line;
    const selectedCharacter = selection.start.character;

    // ツリー内のノードを再帰的に探索する関数
    function findMatchingOccurrence(nodes: TreeNode[]): TextOccurrence | null {
        for (const node of nodes) {
            // TextOccurrenceノードの場合、位置が一致するか確認
            if (node instanceof TextOccurrence) {
                // 行番号と選択テキストが一致し、開始位置が選択範囲内にある場合にマッチとみなす
                if (node.lineNumber === selectedLine &&
                    node.searchText === selectedText &&
                    Math.abs(node.startIndex - selectedCharacter) < node.searchText.length) {
                    return node;
                }
            }

            // 子ノードがある場合は再帰的に探索
            if (node.children && node.children.length > 0) {
                const found = findMatchingOccurrence(node.children);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    // rootNodesから検索
    const occurrence = findMatchingOccurrence(provider['rootNodes']);

    // 対応するノードが見つかった場合は選択状態に設定
    if (occurrence) {
        occurrence.isSelected = true;
        provider.refreshNode(occurrence);

        // 可能であればサイドバー内でそのノードを表示するようにスクロール
        try {
            vscode.commands.executeCommand('rangeNavigatorView.reveal', occurrence, {
                select: true,
                focus: false,
                expand: true
            });
        } catch (error) {
            console.log("Error revealing node in tree view:", error);
        }

        return occurrence;
    }

    return null;
}

/**
 * 検索結果から指定の行・位置に一致するTextOccurrenceを選択状態にするヘルパー関数
 * @param provider プロバイダ
 * @param lineNumber 行番号
 * @param startIndex 開始位置
 * @param searchText 検索テキスト
 * @param selectedOccurrence 現在選択中の出現箇所
 * @returns 新しく選択された出現箇所
 */
export function updateOccurrenceSelection(
    provider: any,
    lineNumber: number,
    startIndex: number,
    searchText: string,
    selectedOccurrence: TextOccurrence | null
): TextOccurrence | null {
    // 前の選択をクリア
    if (selectedOccurrence) {
        selectedOccurrence.isSelected = false;
        provider.refreshNode(selectedOccurrence);
    }

    // ツリー内のノードを再帰的に探索する関数
    function findOccurrenceNode(nodes: TreeNode[]): TextOccurrence | null {
        for (const node of nodes) {
            // TextOccurrenceノードの場合、位置が一致するか確認
            if (node instanceof TextOccurrence) {
                if (node.lineNumber === lineNumber &&
                    node.startIndex === startIndex &&
                    node.searchText === searchText) {
                    return node;
                }
            }

            // 子ノードがある場合は再帰的に探索
            if (node.children && node.children.length > 0) {
                const found = findOccurrenceNode(node.children);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    // rootNodesから検索
    const occurrence = findOccurrenceNode(provider['rootNodes']);

    // 対応するノードが見つかった場合は選択状態に設定
    if (occurrence) {
        occurrence.isSelected = true;
        provider.refreshNode(occurrence);
        return occurrence;
    }

    return null;
}

/**
 * 指定されたテキストの出現箇所をすべて検索し、コード構造と関連付ける
 * @param editor エディタ
 * @param searchText 検索テキスト
 * @param provider プロバイダ
 * @param prevSelection 以前の選択
 * @param selectedOccurrence 現在選択中の出現箇所
 * @returns 新しく選択された出現箇所
 */
export async function findOccurrencesInStructure(
    editor: vscode.TextEditor,
    searchText: string,
    provider: any,
    prevSelection: TextOccurrence | null = null,
    selectedOccurrence: TextOccurrence | null = null
): Promise<TextOccurrence | null> {
    const document = editor.document;
    const results: TextOccurrence[] = [];

    // 明示的にboolean型に変換する
    const hasValidSearchText = Boolean(searchText && searchText.trim() !== "");
    // コンテキスト変数を更新
    updateSearchContext(hasValidSearchText);

    // 選択テキストが空の場合は早期リターン
    if (!searchText || searchText.trim() === "") {
        provider.refresh([]);
        return null;
    }

    try {
        // 正規表現で特殊文字をエスケープ
        const escapedText = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

        // 完全一致検索のための正規表現パターンを作成
        const searchRegex = new RegExp("\\b" + escapedText + "\\b", "g");

        // ドキュメント内の各行を検索
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;

            // 行が検索パターンにマッチするかをテスト
            if (!searchRegex.test(lineText)) {
                continue;
            }

            // 正規表現の lastIndex をリセット
            searchRegex.lastIndex = 0;

            let match;
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

        // 検索結果が0件の場合
        if (results.length === 0) {
            // ハイライトをクリア
            clearHighlights(editor);

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

            return null;
        }

        // 検索結果がある場合のみ、ハイライトを適用
        if (results.length > 0) {
            // 現在の選択範囲に対応する行全体のハイライトを適用
            const selection = editor.selection;
            const lineRange = new vscode.Range(
                selection.start.line, 0,
                selection.end.line, editor.document.lineAt(selection.end.line).text.length
            );
            highlightSelectedLine(editor, lineRange);

            // 選択範囲のハイライトを追加
            highlightSelection(editor, selection);

            // スクロールバーにハイライトを表示
            highlightAllOccurrencesInScrollbar(editor, results);
        }

        // エディタの選択位置から対応するサイドバー項目を更新
        let newSelectedOccurrence = selectedOccurrence;
        if (editor.selection && !editor.selection.isEmpty) {
            setTimeout(() => {
                newSelectedOccurrence = updateSidebarSelectionFromEditor(
                    editor,
                    editor.selection,
                    provider,
                    selectedOccurrence
                );
            }, 200);
        }

        // ファイル拡張子を取得
        const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';

        // サポートされている拡張子かどうかをチェック
        const isStructuredView = SUPPORTED_EXTENSIONS.includes(fileExtension);

        if (isStructuredView) {
            // サポートされている拡張子の場合のみコード構造を解析
            const codeStructures = await parseCodeStructure(document);

            // 結果をコード構造と関連付ける
            const organizedResults = organizeOccurrencesByStructure(results, codeStructures, document);

            // 以前の選択状態を復元する処理を追加
            if (prevSelection) {
                // 前の選択に一致する新しいノードを探す
                restoreSelection(organizedResults, prevSelection);
            }

            // 検索結果をプロバイダーに通知
            provider.refresh(organizedResults);
        } else {
            // サポートされていない拡張子の場合はフラットな結果リストを表示
            // 「検索結果」ルートノードを作成
            const resultRootNode = new TreeNode(
                l10n.t('Search Results ({0})', results.length),
                vscode.TreeItemCollapsibleState.Expanded
            );

            // 検索結果を追加
            for (const result of results) {
                resultRootNode.addChild(result);
            }

            // 以前の選択状態を復元
            if (prevSelection) {
                restoreSelection([resultRootNode], prevSelection);
            }

            // 検索結果をプロバイダーに通知
            provider.refresh([resultRootNode]);
        }

        return newSelectedOccurrence;
    } catch (error) {
        console.error("Error in findOccurrencesInStructure:", error);
        vscode.window.showErrorMessage(`Error finding occurrences: ${error}`);
        return null;
    }
}
