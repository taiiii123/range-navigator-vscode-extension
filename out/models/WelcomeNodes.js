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
exports.InstructionNode = exports.UsageInfoNode = exports.WelcomeMessageNode = void 0;
const vscode = __importStar(require("vscode"));
const vscode_1 = require("vscode");
const TreeNode_1 = require("./TreeNode");
/**
 * ウェルカムメッセージノード
 * 拡張機能の初期表示用のウェルカムメッセージを表示
 */
class WelcomeMessageNode extends TreeNode_1.TreeNode {
    constructor() {
        // 言語に基づいてメッセージを変更
        const message = vscode_1.l10n.t('Welcome to Range Navigator! 🔍');
        super(message, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon("star");
        // ツールチップも言語に基づいて設定
        this.tooltip = vscode_1.l10n.t('Range Navigator helps you find and visualize occurrences of selected text in your code.');
    }
}
exports.WelcomeMessageNode = WelcomeMessageNode;
/**
 * 使用方法ノード
 * 拡張機能の使用方法を説明する階層構造のノード
 */
class UsageInfoNode extends TreeNode_1.TreeNode {
    constructor() {
        // 言語に基づいてタイトルを変更
        const messageTitle = vscode_1.l10n.t('How to use:');
        super(messageTitle, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon("info");
        // 検索機能に関する説明
        const searchFeaturesNode = new TreeNode_1.TreeNode(vscode_1.l10n.t('Search Features:'), vscode.TreeItemCollapsibleState.Expanded);
        searchFeaturesNode.iconPath = new vscode.ThemeIcon('search');
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('1. Select text in the editor'), 'selection'));
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('2. All exact matches will be shown here'), 'list-tree'));
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('3. Click on an item to navigate to it'), 'go-to-file'));
        searchFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('4. Selected occurrences are highlighted'), 'symbol-color'));
        // 履歴機能に関する説明
        const historyFeaturesNode = new TreeNode_1.TreeNode(vscode_1.l10n.t('History Features:'), vscode.TreeItemCollapsibleState.Expanded);
        historyFeaturesNode.iconPath = new vscode.ThemeIcon('history');
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('1. Selections you navigate to are saved in history'), 'bookmark'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('2. Click the history icon to view past selections'), 'clock'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('3. History entries show the line content and position'), 'list-ordered'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('4. Click a history item to return to that location'), 'arrow-right'));
        historyFeaturesNode.addChild(new InstructionNode(vscode_1.l10n.t('5. Line selection history is preserved between sessions'), 'save'));
        // メインノードに追加
        this.addChild(searchFeaturesNode);
        this.addChild(historyFeaturesNode);
    }
}
exports.UsageInfoNode = UsageInfoNode;
/**
 * 使用方法の各ステップノード
 * 使用方法の個々のステップを表示
 */
class InstructionNode extends TreeNode_1.TreeNode {
    constructor(instruction, iconName) {
        super(instruction, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
exports.InstructionNode = InstructionNode;
//# sourceMappingURL=WelcomeNodes.js.map