import { RangeNavigator } from './types/types';

// サポートされている拡張子の定義
// 構造化表示対象の拡張子
export const STRUCTURED_VIEW_EXTENSIONS: RangeNavigator.FileExtensions = {
  // JavaScript/TypeScript
  jsFamily: ['js', 'jsx', 'ts', 'tsx'],
  // Java
  javaFamily: ['java']
};

// すべてのサポート拡張子を一つの配列に展開
export const SUPPORTED_EXTENSIONS: string[] = [
  ...STRUCTURED_VIEW_EXTENSIONS.jsFamily,
  ...STRUCTURED_VIEW_EXTENSIONS.javaFamily
];
