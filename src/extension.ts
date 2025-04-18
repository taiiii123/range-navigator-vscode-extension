import * as vscode from "vscode";

// グローバル変数としてデコレーションタイプを宣言
let highlightDecorationType: vscode.TextEditorDecorationType;

class RangeNavigatorProvider
	implements vscode.TreeDataProvider<TextOccurrence> {
	private _onDidChangeTreeData: vscode.EventEmitter<
		TextOccurrence | undefined | null | void
	> = new vscode.EventEmitter<TextOccurrence | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<
		TextOccurrence | undefined | null | void
	> = this._onDidChangeTreeData.event;

	private occurrences: TextOccurrence[] = [];

	constructor(private context: vscode.ExtensionContext) { }

	refresh(searchResults: TextOccurrence[]): void {
		this.occurrences = searchResults;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TextOccurrence): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TextOccurrence): Thenable<TextOccurrence[]> {
		if (element) {
			return Promise.resolve([]);
		}
		return Promise.resolve(this.occurrences);
	}
}

class TextOccurrence extends vscode.TreeItem {
	// ハイライト用の行範囲を追加
	public readonly lineRange: vscode.Range;

	constructor(
		public readonly searchText: string,
		public readonly lineText: string,
		public readonly lineNumber: number,
		public readonly startIndex: number,
		public readonly position: vscode.Position,
		public readonly command?: vscode.Command
	) {
		super("", vscode.TreeItemCollapsibleState.None);

		// 行全体の範囲を保存
		this.lineRange = new vscode.Range(
			lineNumber, 0,
			lineNumber, lineText.length
		);

		// テキストの切り出しサイズを調整
		const contextBefore = 20;
		const contextAfter = 30;
		const startPos = Math.max(0, startIndex - contextBefore);
		const textBefore = lineText.substring(startPos, startIndex);
		const highlightedText = lineText.substring(
			startIndex,
			startIndex + searchText.length
		);
		const textAfter = lineText.substring(
			startIndex + searchText.length,
			startIndex + searchText.length + contextAfter
		);

		// Line番号を先頭に表示するように変更
		const linePrefix = `${lineNumber + 1}:  `;
		const fullText = `${linePrefix}${textBefore}${highlightedText}${textAfter}`;

		// ハイライトの位置も調整（XX: の分だけずらす）
		const prefixLength = linePrefix.length;
		const highlightStart = prefixLength + textBefore.length;
		const highlightEnd = highlightStart + highlightedText.length;

		this.label = {
			label: fullText,
			highlights: [[highlightStart, highlightEnd]]
		};

		// description はもう使わないので空にするか、必要に応じて別の情報を表示
		this.description = "";

		// アイコンを設定（青いアイコンを使用）
		// アイコン https://microsoft.github.io/vscode-codicons/dist/codicon.html
		this.iconPath = new vscode.ThemeIcon("list-selection", new vscode.ThemeColor("terminal.ansiBlue"));

		// ツールチップにはフルラインテキストを表示
		this.tooltip = lineText.trim();
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log("Activating Range Navigator extension");

	// ハイライト用のデコレーションタイプを作成（オレンジ色に変更）
	highlightDecorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(255, 165, 0, 0.3)',  // オレンジ色（半透明）
		border: '1px solid',
		borderColor: 'rgba(255, 140, 0, 0.8)',  // 少し濃いオレンジ色の枠線
		isWholeLine: true  // 行全体をハイライト
	});

	// プロバイダーを登録
	const rangeNavigatorProvider = new RangeNavigatorProvider(context);

	// ツリービューを作成
	let treeView = vscode.window.createTreeView("rangeNavigatorView", {
		treeDataProvider: rangeNavigatorProvider,
		showCollapseAll: true,
	});

	// クリックされた行への移動とハイライト表示を行うコマンド
	context.subscriptions.push(
		vscode.commands.registerCommand('rangeNavigator.gotoOccurrence',
			(docUri: vscode.Uri, position: vscode.Position, range: vscode.Range) => {
				vscode.window.showTextDocument(docUri).then(editor => {
					// カーソル位置を設定
					editor.selection = new vscode.Selection(position, position);
					// 見やすいようにその位置が画面中央に来るようにスクロール
					editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

					setTimeout(() => {
						highlightSelectedLine(editor, range);
					}, 100); // 少し待ってからハイライト
				});
			}
		)
	);

	// テキスト選択が変更されたときの処理
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection((event) => {
			// サイドバーが表示されていない場合は何もしない
			if (!treeView.visible) {
				return;
			}

			const editor = event.textEditor;
			const selection = editor.selection;

			// 選択されたテキストを取得
			if (!selection.isEmpty) {
				const selectedText = editor.document.getText(selection);
				console.log(`Selected text: "${selectedText}"`);

				// 選択テキストが存在する場合は検索を実行
				if (selectedText && selectedText.length > 0) {
					findOccurrences(editor, selectedText, rangeNavigatorProvider);
				}
			} else {
				// 選択がない場合はリストをクリア
				rangeNavigatorProvider.refresh([]);
				// ハイライトも消去
				clearHighlights(editor);
			}
		})
	);

	// サイドバーが表示状態になったときのイベント
	context.subscriptions.push(
		treeView.onDidChangeVisibility((event) => {
			if (event.visible) {
				const editor = vscode.window.activeTextEditor;
				if (editor && !editor.selection.isEmpty) {
					const selectedText = editor.document.getText(editor.selection);
					findOccurrences(editor, selectedText, rangeNavigatorProvider);
				}
			} else {
				// サイドバーが閉じられたときにハイライトを消去
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					clearHighlights(editor);
				}
			}
		})
	);

	// エディタが変更されたときの処理
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			// アクティブなエディタが変更され、サイドバーが表示されている場合
			if (editor && treeView.visible) {
				if (!editor.selection.isEmpty) {
					const selectedText = editor.document.getText(editor.selection);
					findOccurrences(editor, selectedText, rangeNavigatorProvider);
				} else {
					// 選択がない場合はリストをクリア
					rangeNavigatorProvider.refresh([]);
					// ハイライトも消去
					clearHighlights(editor);
				}
			}
		})
	);

	context.subscriptions.push(treeView);
}

// ハイライトを消去する関数
function clearHighlights(editor: vscode.TextEditor) {
	if (editor) {
		editor.setDecorations(highlightDecorationType, []);
	}
}

// 指定された行をハイライトする関数
function highlightSelectedLine(editor: vscode.TextEditor, range: vscode.Range) {
	// 既存のハイライトをクリア
	clearHighlights(editor);

	// 新しいハイライトを設定
	editor.setDecorations(highlightDecorationType, [range]);

	// デバッグ出力
	console.log(`Highlighting line ${range.start.line + 1}`);
}

// 指定されたテキストの出現箇所をすべて検索する
async function findOccurrences(
	editor: vscode.TextEditor,
	searchText: string,
	provider: RangeNavigatorProvider
): Promise<void> {
	const document = editor.document;
	const results: TextOccurrence[] = [];

	// 選択されたテキストが空または空白のみの場合、結果をクリアして終了
	if (!searchText || searchText.trim() === "") {
		provider.refresh([]);
		return;
	}

	try {
		// 正規表現で特殊文字をエスケープ
		const escapedText = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

		// 行ごとに検索
		for (let i = 0; i < document.lineCount; i++) {
			const line = document.lineAt(i);
			const lineText = line.text;

			// この行に検索テキストが含まれているかをチェック
			if (lineText.includes(searchText)) {
				let match;
				const lineRegex = new RegExp(escapedText, "g");

				while ((match = lineRegex.exec(lineText)) !== null) {
					const startPos = new vscode.Position(i, match.index);
					const endPos = new vscode.Position(
						i,
						match.index + searchText.length
					);

					// 行全体の範囲を取得
					const lineRange = new vscode.Range(
						new vscode.Position(i, 0),  // 行の先頭
						new vscode.Position(i, lineText.length)  // 行の末尾
					);

					// クリックしたらその位置に移動してハイライトするコマンドを追加
					const command = {
						title: "Go to Occurrence",
						command: "rangeNavigator.gotoOccurrence",
						arguments: [
							document.uri,
							startPos,
							lineRange
						],
					};

					results.push(
						new TextOccurrence(
							searchText,
							lineText,
							i,
							match.index,
							startPos,
							command
						)
					);
				}
			}
		}

		// 検索結果をプロバイダーに通知
		provider.refresh(results);
	} catch (error) {
		console.error("Error in findOccurrences:", error);
		vscode.window.showErrorMessage(`Error finding occurrences: ${error}`);
	}
}

export function deactivate() {
	// デコレーションタイプを破棄
	if (highlightDecorationType) {
		highlightDecorationType.dispose();
	}
}
