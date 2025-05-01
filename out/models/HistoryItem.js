"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryItem = void 0;
/**
 * 検索履歴アイテムを表すクラス
 * 検索テキストと出現位置情報を保持
 */
class HistoryItem {
    searchText;
    occurrenceInfo;
    /**
     * コンストラクタ
     * @param searchText 検索テキスト
     * @param occurrenceInfo 出現位置情報
     */
    constructor(searchText, occurrenceInfo) {
        this.searchText = searchText;
        this.occurrenceInfo = occurrenceInfo;
    }
}
exports.HistoryItem = HistoryItem;
//# sourceMappingURL=HistoryItem.js.map