import * as vscode from 'vscode';

/**
 * 階層構造をサポートするための拡張したTreeItemクラス
 * VSCodeのTreeItemを拡張し、親子関係を管理する機能を追加
 */
export class TreeNode extends vscode.TreeItem {
    // 子ノードを格納する配列
    public children: TreeNode[] = [];

    // 親ノードへの参照
    public parentNode?: TreeNode;

    /**
     * コンストラクタ
     * @param label ノードの表示ラベル
     * @param collapsibleState 折りたたみ状態
     */
    constructor(
        label: string | vscode.TreeItemLabel,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }

    /**
     * 子ノードを追加するメソッド
     * @param child 追加する子ノード
     */
    public addChild(child: TreeNode): void {
        this.children.push(child);
        child.parentNode = this;
    }
}
