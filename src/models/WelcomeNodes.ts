import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { TreeNode } from './TreeNode';

/**
 * ウェルカムメッセージノード
 * 拡張機能の初期表示用のウェルカムメッセージを表示
 */
export class WelcomeMessageNode extends TreeNode {
    constructor() {
        // 言語に基づいてメッセージを変更
        const message = l10n.t('Welcome to Range Navigator! 🔍');

        super(message, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon("star");

        // ツールチップも言語に基づいて設定
        this.tooltip = l10n.t('Range Navigator helps you find and visualize occurrences of selected text in your code.');
    }
}

/**
 * 使用方法ノード
 * 拡張機能の使用方法を説明する階層構造のノード
 */
export class UsageInfoNode extends TreeNode {
    constructor() {
        // 言語に基づいてタイトルを変更
        const messageTitle = l10n.t('How to use:');

        super(messageTitle, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon("info");

        // 検索機能に関する説明
        const searchFeaturesNode = new TreeNode(
            l10n.t('Search Features:'),
            vscode.TreeItemCollapsibleState.Expanded
        );
        searchFeaturesNode.iconPath = new vscode.ThemeIcon('search');

        searchFeaturesNode.addChild(new InstructionNode(l10n.t('1. Select text in the editor'), 'selection'));
        searchFeaturesNode.addChild(new InstructionNode(l10n.t('2. All exact matches will be shown here'), 'list-tree'));
        searchFeaturesNode.addChild(new InstructionNode(l10n.t('3. Click on an item to navigate to it'), 'go-to-file'));
        searchFeaturesNode.addChild(new InstructionNode(l10n.t('4. Selected occurrences are highlighted'), 'symbol-color'));

        // 履歴機能に関する説明
        const historyFeaturesNode = new TreeNode(
            l10n.t('History Features:'),
            vscode.TreeItemCollapsibleState.Expanded
        );
        historyFeaturesNode.iconPath = new vscode.ThemeIcon('history');

        historyFeaturesNode.addChild(new InstructionNode(l10n.t('1. Selections you navigate to are saved in history'), 'bookmark'));
        historyFeaturesNode.addChild(new InstructionNode(l10n.t('2. Click the history icon to view past selections'), 'clock'));
        historyFeaturesNode.addChild(new InstructionNode(l10n.t('3. History entries show the line content and position'), 'list-ordered'));
        historyFeaturesNode.addChild(new InstructionNode(l10n.t('4. Click a history item to return to that location'), 'arrow-right'));
        historyFeaturesNode.addChild(new InstructionNode(l10n.t('5. Line selection history is preserved between sessions'), 'save'));

        // メインノードに追加
        this.addChild(searchFeaturesNode);
        this.addChild(historyFeaturesNode);
    }
}

/**
 * 使用方法の各ステップノード
 * 使用方法の個々のステップを表示
 */
export class InstructionNode extends TreeNode {
    constructor(
        instruction: string,
        iconName: string
    ) {
        super(instruction, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
