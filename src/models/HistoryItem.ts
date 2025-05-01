// 型定義ファイルを直接インポート
import * as vscode from 'vscode';
import { OccurrenceInfo } from '../types/types';

/**
 * 検索履歴アイテムを表すクラス
 * 検索テキストと出現位置情報を保持
 */
export class HistoryItem {
    /**
     * コンストラクタ
     * @param searchText 検索テキスト
     * @param occurrenceInfo 出現位置情報
     */
    constructor(
        public readonly searchText: string,
        public readonly occurrenceInfo: OccurrenceInfo
    ) { }
}
