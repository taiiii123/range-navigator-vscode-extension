import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { CodeStructureNode } from '../models/CodeStructureNode';
import { TreeNode } from '../models/TreeNode';
import { TextOccurrence } from '../models/TextOccurrence';

/**
 * コードの構造（クラス、関数など）を解析する機能
 * @param document 解析するテキストドキュメント
 * @returns コード構造ノードの配列
 */
export async function parseCodeStructure(document: vscode.TextDocument): Promise<CodeStructureNode[]> {
    const structures: CodeStructureNode[] = [];
    const text = document.getText();

    // ファイル拡張子を取得して言語を特定
    const fileExtension = document.fileName.split('.').pop()?.toLowerCase() || '';

    // 様々な言語のクラス定義に対応するパターン
    const classPattern = /\b(?:class|struct|interface|trait|enum|record)\s+(\w+)(?:\s+(?:extends|implements|:|<|inherits|with)\s+[\w\s,<>]+)?/g;

    // 様々な言語の関数定義に対応するパターン
    const functionPattern = /\b(?:function|func|fn|def|sub|procedure|proc|method|fun|public|private|protected|static|async)\s+(\w+)\s*\([^)]*\)/g;

    // 様々な言語のメソッド定義に対応するパターン
    const methodPattern = /(?:\b(?:public|private|protected|internal|final|override|virtual|static|async)(?:\s+|\s+\w+\s+))?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\],\s]+\s*)?(?:{\s*|=>|throws|is|as|->)/g;

    // クラスを検索
    let match;
    while ((match = classPattern.exec(text)) !== null) {
        const className = match[1];
        const startPos = document.positionAt(match.index);

        // クラスの終了位置を特定
        let classEndIndex = findMatchingBrace(text, document.offsetAt(startPos));

        const endPos = classEndIndex !== -1 ?
            document.positionAt(classEndIndex) :
            document.positionAt(text.length);

        const range = new vscode.Range(startPos, endPos);
        const classNode = new CodeStructureNode(className, 'class', range, document);
        structures.push(classNode);

        // クラス本体のテキストを抽出して解析
        const classBodyText = text.substring(
            document.offsetAt(startPos),
            document.offsetAt(endPos)
        );

        // メソッドをクラス内で検索
        const methodRegex = new RegExp(methodPattern);
        let methodMatch;

        // クラス本体内でのオフセットを計算するための基準値
        const classBodyOffset = document.offsetAt(startPos);

        while ((methodMatch = methodRegex.exec(classBodyText)) !== null) {
            const methodName = methodMatch[1];

            // メソッド名がconstructorでない場合のみ処理
            const constructorNames = ['constructor', '__construct', 'New', 'init'];
            if (!constructorNames.includes(methodName)) {
                // クラス内でのメソッドの位置を計算
                const methodStartOffset = classBodyOffset + methodMatch.index;
                const methodStartPos = document.positionAt(methodStartOffset);

                // メソッドの終了位置を特定
                const methodEndIndex = findMatchingBrace(text, methodStartOffset);
                const methodEndPos = methodEndIndex !== -1 ?
                    document.positionAt(methodEndIndex) :
                    document.positionAt(text.length);

                const methodRange = new vscode.Range(methodStartPos, methodEndPos);
                const methodNode = new CodeStructureNode(
                    methodName,
                    'method',
                    methodRange,
                    document
                );

                // メソッドをクラスの子ノードとして追加
                classNode.addChild(methodNode);
            }
        }
    }

    // 独立した関数を検索（クラス外の関数）
    while ((match = functionPattern.exec(text)) !== null) {
        const functionName = match[1];
        const startPos = document.positionAt(match.index);

        // 関数がクラス内にあるかチェック
        let isInsideClass = false;
        for (const structure of structures) {
            if (structure.type === 'class' && structure.range.contains(startPos)) {
                isInsideClass = true;
                break;
            }
        }

        // クラス内の関数は既にメソッドとして処理されているためスキップ
        if (isInsideClass) {
            continue;
        }

        const funcEndIndex = findMatchingBrace(text, document.offsetAt(startPos));
        const endPos = funcEndIndex !== -1 ?
            document.positionAt(funcEndIndex) :
            document.positionAt(text.length);

        const range = new vscode.Range(startPos, endPos);
        structures.push(new CodeStructureNode(functionName, 'function', range, document));
    }

    return structures;
}

/**
 * 対応する閉じ括弧を見つける関数
 * @param text 検索するテキスト
 * @param startOffset 開始位置
 * @returns 閉じ括弧の次の位置、見つからない場合は-1
 */
export function findMatchingBrace(text: string, startOffset: number): number {
    // 開始括弧を見つける
    let openBracePos = -1;
    for (let i = startOffset; i < text.length; i++) {
        if (text[i] === '{') {
            openBracePos = i;
            break;
        } else if (text[i] === ';') {
            // セミコロンで終わる言語（特に宣言のみの場合）はここで終了
            return i + 1;
        }
    }

    // 開始括弧が見つからなかった場合
    if (openBracePos === -1) {
        return -1;
    }

    // 対応する閉じ括弧を探す
    let braceCount = 1;
    for (let i = openBracePos + 1; i < text.length; i++) {
        const char = text[i];

        if (char === '{') {
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                return i + 1; // 閉じ括弧の次の位置
            }
        }
    }

    return -1; // 対応する閉じ括弧が見つからない
}

/**
 * 検索結果をコード構造と関連付ける
 * @param occurrences 検索結果の出現箇所
 * @param structures コード構造ノード
 * @param document テキストドキュメント
 * @returns 構造化された検索結果
 */
export function organizeOccurrencesByStructure(
    occurrences: TextOccurrence[],
    structures: CodeStructureNode[],
    document: vscode.TextDocument
): TreeNode[] {
    // 構造化された新しいノードツリーを作成
    const rootNodes: TreeNode[] = [];

    // まず、構造ノードの新しいインスタンスを作成
    for (const structure of structures) {
        const newNode = new CodeStructureNode(
            structure.name,
            structure.type,
            structure.range,
            document
        );

        // 子ノードを再帰的に処理
        for (const child of structure.children) {
            if (child instanceof CodeStructureNode) {
                const childNode = new CodeStructureNode(
                    child.name,
                    child.type,
                    child.range,
                    document
                );
                newNode.addChild(childNode);
            }
        }

        rootNodes.push(newNode);
    }

    // 未分類の検索結果を格納するノード
    const uncategorizedNode = new TreeNode(
        l10n.t("📍 Other Occurrences"),
        vscode.TreeItemCollapsibleState.Expanded
    );

    let hasUncategorized = false;

    // 各出現箇所に関連付け情報を追加
    for (const occurrence of occurrences) {
        const position = occurrence.position;
        let matched = false;

        // 現在の行のテキストを取得
        const lineText = document.lineAt(position.line).text;

        // 出現箇所が属する最も詳細な構造を見つけるループ
        for (let i = 0; i < rootNodes.length; i++) {
            const node = rootNodes[i];

            // CodeStructureNodeの場合のみチェック
            if (node instanceof CodeStructureNode) {
                // 位置が構造の範囲内かチェック
                if (node.range.contains(position)) {
                    // クラス内のメソッドをチェック
                    let methodMatched = false;
                    if (node.type === 'class') {
                        for (let j = 0; j < node.children.length; j++) {
                            const childNode = node.children[j];
                            if (childNode instanceof CodeStructureNode &&
                                childNode.type === 'method' &&
                                childNode.range.contains(position)) {
                                childNode.addChild(occurrence);
                                methodMatched = true;
                                matched = true;
                                break;
                            }
                        }
                    }

                    // メソッド内で見つからなかった場合はクラスまたは関数直下に追加
                    if (!methodMatched) {
                        node.addChild(occurrence);
                        matched = true;
                    }
                    break;
                }
            }
        }

        // どの構造にも属さない場合は「その他」に分類
        if (!matched) {
            uncategorizedNode.addChild(occurrence);
            hasUncategorized = true;
        }
    }

    // 検索結果を持たない構造を削除（階層的に処理）
    // 1. まずメソッドレベルで検索結果がないものを削除
    for (const rootNode of rootNodes) {
        // 検索結果を含むメソッドだけを残す
        rootNode.children = rootNode.children.filter(child => {
            if (child instanceof CodeStructureNode) {
                return child.children.length > 0;
            }
            return true; // 検索結果自体は常に残す
        });
    }

    // 2. 次にクラス/関数レベルで検索結果がないものを削除
    const filteredRootNodes = rootNodes.filter(node => {
        // 直接の検索結果または有効な子ノードがある場合のみ残す
        return node.children.length > 0;
    });

    // 検索件数をラベルに反映
    for (const node of filteredRootNodes) {
        if (node instanceof CodeStructureNode) {
            node.updateLabelWithCount();

            // 子ノードの件数も更新
            for (const childNode of node.children) {
                if (childNode instanceof CodeStructureNode) {
                    childNode.updateLabelWithCount();
                }
            }
        }
    }

    // 未分類の出現箇所があれば追加
    if (hasUncategorized) {
        // 未分類ノードのラベルを更新
        uncategorizedNode.label = l10n.t('📍 Other Occurrences ({0})', uncategorizedNode.children.length);
        filteredRootNodes.push(uncategorizedNode);
    }

    return filteredRootNodes;
}
