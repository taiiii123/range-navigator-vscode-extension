import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { TreeNode } from './TreeNode';
import { RangeNavigator } from '../types/types';

/**
 * コード構造ノード（クラス・関数などを表す）
 * 階層構造のあるコード要素（クラス、関数、メソッド）を表現するノード
 */
export class CodeStructureNode extends TreeNode {
    /**
     * コンストラクタ
     * @param name コード要素の名前
     * @param type コード要素の種類（クラス、関数、メソッドなど）
     * @param range コード要素の範囲（開始位置から終了位置）
     * @param document 関連するテキストドキュメント
     * @param collapsibleState 折りたたみ状態
     */
    constructor(
        public readonly name: string,
        public readonly type: RangeNavigator.CodeStructureType,
        public readonly range: vscode.Range,
        public readonly document: vscode.TextDocument,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded
    ) {
        // ラベルをカスタマイズしない（後で更新する）
        super(name, collapsibleState);

        // アイコンの設定
        switch (type) {
            case 'class':
                this.iconPath = new vscode.ThemeIcon("symbol-class");
                break;
            case 'function':
                this.iconPath = new vscode.ThemeIcon("symbol-function");
                break;
            case 'method':
                this.iconPath = new vscode.ThemeIcon("symbol-method");
                break;
            default:
                this.iconPath = new vscode.ThemeIcon("symbol-misc");
        }

        // 設定からナビゲーション機能の有効/無効を取得
        const config = vscode.workspace.getConfiguration('rangeNavigator');
        const enableNavigation = config.get('enableNavigationOnClick', true);

        // 設定が有効な場合のみコマンドを設定
        if (enableNavigation) {
            // コマンドの設定（クリックでソースコードの位置に移動）
            this.command = {
                title: "Go to Definition",
                command: "rangeNavigator.gotoDefinition",
                arguments: [document.uri, range.start, range]
            };
        }
    }

    /**
     * 子ノードが追加された後にラベルを更新するメソッド
     * 検索結果件数を表示するためのラベル更新
     */
    public updateLabelWithCount(): void {
        // 子ノードの数を取得（検索結果の件数）
        const count = this.children.length;

        // 件数を表示するラベルを作成
        const label = l10n.t('{0} ({1})', this.name, count);

        // ラベルを更新
        this.label = label;
    }
}
