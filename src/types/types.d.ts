import * as vscode from 'vscode';

// 検索行を記録するための拡張情報
export interface OccurrenceInfo {
    documentUri: vscode.Uri;
    lineNumber: number;
    lineText: string;
    position: vscode.Position;
    searchText: string;
    searchTextLength: number;
}

export declare namespace RangeNavigator {
    // コード構造の種類を表す型
    export type CodeStructureType = 'class' | 'function' | 'method' | 'other';

    // 検索モードの種類
    export type SearchMode = 'standard' | 'history';

    // サポートされている拡張子のカテゴリ
    export interface FileExtensions {
        jsFamily: string[];
        javaFamily: string[];
        // 将来的な拡張用にその他の言語ファミリーを追加可能
        pythonFamily?: string[];
        cppFamily?: string[];
    }
}

// モジュール拡張
declare global {
    // グローバル変数やインターフェースを定義する場合はここに追加
    interface Window {
        rangeNavigatorState?: {
            lastSearchedText?: string;
            isNavigatingFromSidebar?: boolean;
        };
    }
}
