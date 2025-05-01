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
exports.TreeNode = void 0;
const vscode = __importStar(require("vscode"));
/**
 * 階層構造をサポートするための拡張したTreeItemクラス
 * VSCodeのTreeItemを拡張し、親子関係を管理する機能を追加
 */
class TreeNode extends vscode.TreeItem {
    // 子ノードを格納する配列
    children = [];
    // 親ノードへの参照
    parentNode;
    /**
     * コンストラクタ
     * @param label ノードの表示ラベル
     * @param collapsibleState 折りたたみ状態
     */
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
    }
    /**
     * 子ノードを追加するメソッド
     * @param child 追加する子ノード
     */
    addChild(child) {
        this.children.push(child);
        child.parentNode = this;
    }
}
exports.TreeNode = TreeNode;
//# sourceMappingURL=TreeNode.js.map