"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_EXTENSIONS = exports.STRUCTURED_VIEW_EXTENSIONS = void 0;
// サポートされている拡張子の定義
// 構造化表示対象の拡張子
exports.STRUCTURED_VIEW_EXTENSIONS = {
    // JavaScript/TypeScript
    jsFamily: ['js', 'jsx', 'ts', 'tsx'],
    // Java
    javaFamily: ['java']
};
// すべてのサポート拡張子を一つの配列に展開
exports.SUPPORTED_EXTENSIONS = [
    ...exports.STRUCTURED_VIEW_EXTENSIONS.jsFamily,
    ...exports.STRUCTURED_VIEW_EXTENSIONS.javaFamily
];
//# sourceMappingURL=constants.js.map