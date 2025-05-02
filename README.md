<div align="right" style="font-size: 20px;">

**English** | [日本語](./README.ja.md)

</div>


<p align="center"><img src="./resources/title.png" height=120 style="filter: drop-shadow(10px 10px 10px rgba(0, 0, 0, 0.5));"/></p>


<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#commands">Commands</a> •
  <a href="#editor-context-menu">Editor Context Menu</a> •
  <a href="#settings">Settings</a> •
  <a href="#supported-languages">Supported Languages</a> •
  <a href="#changelog">Changelog</a> •
  <a href="#license">License</a>
</p>

# **Range Navigator** - VS Code Extension 🔍

**Range Navigator** is a VS Code extension that searches for all occurrences of text selected in the editor and displays them in the sidebar.
When you select an item from the list, it jumps to that location and highlights it.

<a id="example"></a>

### 🎬 Example

<p align="center"><img src="https://github.com/user-attachments/assets/67fd8efb-fec6-4367-b70f-248b3dfd34b4" style="filter: drop-shadow(10px 10px 10px rgba(0, 0, 0, 0.5));"/></p>

<a id="features"></a>

# Features ✨

### Basic Features

- 🔍 When you select text in the editor, it searches for and displays all occurrences of the same text
- 🖌️ Click to jump to the occurrence and highlight it
- 🕒 Saves search history for easy access to past search results
- 📂 Expandable and collapsible search results
- 📝 Displays context of occurrences with line numbers
- 🎨 Customizable highlight colors and styles

<a id="installation"></a>

# Installation 📥
1. Open the Extensions sidebar in VS Code (the puzzle piece icon on the left edge)
2. Type "Range Navigator" in the search box
3. Click the "Install" button

Or, run the following command in Quick Open (Ctrl+P or Cmd+P):

```
ext install range-navigator
```

<a id="usage"></a>

# Usage 📖

### Basic Usage
1. Select Text: Select text in the editor
2. Check Results: Click on the Range Navigator icon in the activity bar to open the sidebar
3. View in Sidebar: The sidebar displays occurrences of the selected text
4. Navigate: Click on an item in the list to jump to that code location
5. Clear Search: Click the "Clear Search" button at the top of the sidebar to clear the current search results and line highlights

<a href="#example">Example: See the example above</a>

### Using the History Feature
1. Click on the history icon (🕒) in the Range Navigator sidebar
2. Your past search history will be displayed
3. Click on a history item to jump to that location
4. Clear History: You can clear all saved search history by clicking the "Clear search history" button which appears when you hover over the history heading

> ℹ️ To return to the normal search mode, click the history icon (🕒) again.


<p align="center"><img src="https://github.com/user-attachments/assets/055c8ce4-6efe-481a-b52a-8f812f2aa813" style="filter: drop-shadow(10px 10px 10px rgba(0, 0, 0, 0.5));"/></p>

<a id="commands"></a>

# Commands ⌨️
The following commands are available in Range Navigator:
| Command                              | Description                                                 |
| :----------------------------------- | :---------------------------------------------------------- |
| `range-navigator.findOccurrences`    | Find occurrences (displays input prompt if no text selected) |
| `range-navigator.clearSearch`        | Clear current search results                                |
| `range-navigator.clearHighlightsOnly`| Clear highlights only                                       |
| `range-navigator.expandAll`          | Expand all search results                                   |
| `range-navigator.collapseAll`        | Collapse all search results                                 |
| `range-navigator.toggleSearchMode`   | Toggle Search Mode (History/Normal)                         |
| `range-navigator.clearHistory`       | Clear saved search history                                  |
|                                      |                                                             |

<a id="editor-context-menu"></a>

# Editor Context Menu 📋

Right-clicking in the editor displays "Range Navigator" in the context menu
- Find Occurrences - Search for occurrences of selected text
- Clear highlight - Clear only the highlights
- Switch to History Mode - Switch to search history mode (displayed in normal mode)
- Switch to Normal Mode - Return to normal search mode (displayed in history mode)

<a id="settings"></a>

# Settings ⚙️

### Customizing Settings

Settings can be customized using the following methods or from [settings.json](#settingsjson).

1. Open settings from the VS Code menu: `File > Preferences > Settings`.
2. Type "Range Navigator" in the search bar.
3. The following settings will be displayed:
   - 🎨 Background Color: Sets the background color for the line displayed when you click on a search result. Can be specified in RGBA format with transparency.
   - 🖋️ Border Color: Sets the border color for the line when you click on a search result. Used to highlight the line more clearly.
   - 📊 Scrollbar Color: Sets the color of markers displayed on the scrollbar on the right side of the editor. Helps to visually identify the position of search results in long files.
   - 🔢 Max Size: Specifies the maximum number of search histories to save, between 1 and 30. Setting a larger value is convenient if you perform many searches.
   - 🔄 Auto Show Sidebar On Search: Sets whether to automatically open the sidebar and display search results when text is selected. Convenient if you frequently use the search feature.

### settings.json

You can change the extension [settings](https://code.visualstudio.com/docs/customization/userandworkspace) in the `settings.json` file:

### Highlight Settings
- `rangeNavigator.highlight.backgroundColor` - Background color for highlights
  - Default: `"rgba(255, 165, 0, 0.3)"`
- `rangeNavigator.highlight.borderColor` - Border color for highlights
  - Default: `"rgba(255, 140, 0, 0.8)"`
- `rangeNavigator.highlight.scrollbarColor` - Scrollbar marker color
  - Default: `"rgba(255, 165, 0, 0.7)"`

### Behavior Settings
- `rangeNavigator.history.maxSize` - Maximum number of histories to save (1-30)
  - Default: `10`
- `rangeNavigator.autoShowSidebarOnSearch` - Automatically show sidebar when text is selected
  - Default: `false`

#### Example Settings

```json
{
  "rangeNavigator.highlight.backgroundColor": "rgba(65, 105, 225, 0.2)",
  "rangeNavigator.highlight.borderColor": "rgba(65, 105, 225, 0.7)",
  "rangeNavigator.highlight.scrollbarColor": "rgba(65, 105, 225, 0.7)",
  "rangeNavigator.autoShowSidebarOnSearch": true,
  "rangeNavigator.history.maxSize": 30
}
```

<a id="supported-languages"></a>

# Supported Languages
The following languages support structured display based on code structure (classes, functions, etc.):

- JavaScript/TypeScript
- Java

Basic search functionality can be used with other languages as well.

<a id="changelog"></a>

# Changelog 📝
All changes can be found in the [CHANGELOG](./CHANGELOG.md).

<a id="license"></a>

# License ⚖️
[MIT](./LICENSE)
