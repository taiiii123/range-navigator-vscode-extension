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
exports.CodeStructureNode = void 0;
const vscode = __importStar(require("vscode"));
const vscode_1 = require("vscode");
const TreeNode_1 = require("./TreeNode");
/**
 * コード構造ノード（クラス・関数などを表す）
 * 階層構造のあるコード要素（クラス、関数、メソッド）を表現するノード
 */
class CodeStructureNode extends TreeNode_1.TreeNode {
    name;
    type;
    range;
    document;
    /**
     * コンストラクタ
     * @param name コード要素の名前
     * @param type コード要素の種類（クラス、関数、メソッドなど）
     * @param range コード要素の範囲（開始位置から終了位置）
     * @param document 関連するテキストドキュメント
     * @param collapsibleState 折りたたみ状態
     */
    constructor(name, type, range, document, collapsibleState = vscode.TreeItemCollapsibleState.Expanded) {
        // ラベルをカスタマイズしない（後で更新する）
        super(name, collapsibleState);
        this.name = name;
        this.type = type;
        this.range = range;
        this.document = document;
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
    updateLabelWithCount() {
        // 子ノードの数を取得（検索結果の件数）
        const count = this.children.length;
        // 件数を表示するラベルを作成
        const label = vscode_1.l10n.t('{0} ({1})', this.name, count);
        // ラベルを更新
        this.label = label;
    }
}
exports.CodeStructureNode = CodeStructureNode;
//# sourceMappingURL=CodeStructureNode.js.map