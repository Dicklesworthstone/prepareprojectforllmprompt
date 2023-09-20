import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { get_encoding } from "@dqbd/tiktoken";

const encoding = get_encoding("gpt2");
const CONFIG_KEY = 'prepareForLLM';
let statusBar: vscode.StatusBarItem | null = null;
let fileTokenCache: { [filePath: string]: number } = {};

export function activate(context: vscode.ExtensionContext) {
  cacheTokenCounts();
  let disposable = vscode.commands.registerCommand('extension.prepareForLLM', async () => {
    let tokenLimit = vscode.workspace.getConfiguration(CONFIG_KEY).get('tokenLimit', 7500);
    let exclusionList = vscode.workspace.getConfiguration(CONFIG_KEY).get('exclusions', ['node_modules', '.git']);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showInformationMessage('No workspace is opened.');
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    let allFiles = getAllFiles(rootPath, []);
    const initialChoice = await vscode.window.showQuickPick(['Choose All Files', 'Choose Individual Files', 'Choose Which File Extensions to Select'], { placeHolder: 'Select method of file selection' });
    if (!initialChoice) return;
    if (!statusBar) {
      statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      statusBar.show();
    }
    const updateStatusBar = (tokensUsed: number, tokenLimit: number) => {
      const remainingTokens = tokenLimit - tokensUsed;
      if (statusBar) {
        statusBar.text = `Remaining tokens: ${remainingTokens}`;
      }
    };
    let selectedFiles: string[] = [];
    const previouslySelectedFiles: string[] = context.globalState.get('previouslySelectedFiles', []);
    if (initialChoice === 'Choose Individual Files') {

      const choices: { label: string, picked: boolean }[] = allFiles
      .filter(filePath => !exclusionList.some(ex => filePath.includes(ex)))
      .map(filePath => {
        const tokenCount = fileTokenCache[filePath] || 0;
        return { label: `${filePath} (${tokenCount} tokens)`, picked: previouslySelectedFiles.includes(filePath) };
      });

      let currentTokens = 0;
      const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
      quickPick.items = choices;
      quickPick.canSelectMany = true;
      quickPick.placeholder = 'Select individual files';
      
      // New code to update selectedItems based on globalState
      const previouslySelectedItems = choices.filter(item => previouslySelectedFiles.includes(item.label.split(" ")[0]));
      quickPick.selectedItems = previouslySelectedItems;

      // Update the status bar as the selection changes
      quickPick.onDidChangeSelection(() => {
        const currentTokens = quickPick.selectedItems.reduce((acc, item) => {
          const filePath = item.label.split(" ")[0];
          return acc + fileTokenCache[filePath];
        }, 0);
        updateStatusBar(currentTokens, tokenLimit);
      });

      const pickedFiles = await new Promise<vscode.QuickPickItem[]>((resolve) => {
        quickPick.onDidAccept(() => {
          resolve([...quickPick.selectedItems]);
          quickPick.hide();
        });
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
      }) || [];
      
      selectedFiles = pickedFiles.map((item) => item.label.split(" ")[0]);
      await context.globalState.update('previouslySelectedFiles', selectedFiles);

    } else {
      const availableExtensions: string[] = Array.from(new Set(allFiles.map((file: string) => path.extname(file))));
      const selectedExtensions = await vscode.window.showQuickPick(availableExtensions, { canPickMany: true, placeHolder: 'Select file extension(s)' }) || [];
      selectedFiles = allFiles.filter((file: string) => selectedExtensions.includes(path.extname(file)));
    }
    if (selectedFiles.length === 0) return;
    let langSet: Set<string> = new Set();
    let prompt: string = '';
    let currentTokens: number = 0;
    let totalSize: number = 0;
    let batch: string[] = [];
    let currentBatchTokens: number = 0;
    for (const filePath of selectedFiles) {
      if (exclusionList.some((ex: string) => filePath.includes(ex)) || !fs.existsSync(filePath) || filePath.startsWith('Untitled')) continue;
      const stats: fs.Stats = fs.statSync(filePath);
      totalSize += stats.size;
      if (totalSize > 1024 * 1024) {
        vscode.window.showInformationMessage('Files too large to load into memory.');
        return;
      }
      const content: string = fs.readFileSync(filePath, 'utf-8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const lang: string = path.extname(filePath).slice(1);
      const languageName: string = getLanguageName(lang);
      langSet.add(languageName);
      const filePrompt: string = `\n---\n\n${filePath}\n\`\`\`${languageName}\n${content}\n\`\`\`\n`;
      const tokens: Uint32Array = encoding.encode(filePrompt);
      currentTokens += tokens.length;
      if (currentBatchTokens + tokens.length > tokenLimit) {
        batch.push(prompt);
        prompt = '';
        currentBatchTokens = 0;
      }
      prompt += filePrompt;
      currentBatchTokens += tokens.length;
    }
    if (batch.length === 0 || (batch.length > 0 && prompt.length > 0)) {
      batch.push(prompt);
    }
    const languagesList: string = Array.from(langSet).join(", ");
    const preamble: string = `The following are the various ${languagesList} code files for a project. Each relative file path will be listed, followed by the file contents of that code file in a block:\n\n`;
    let isFirstBatch = true;
    for (const b of batch) {
      let completeBatch: string = isFirstBatch ? preamble + b : b;
      isFirstBatch = false;
      if (encoding.encode(completeBatch).length <= tokenLimit) {
        const doc = await vscode.workspace.openTextDocument({ content: completeBatch, language: 'markdown' });
        await vscode.window.showTextDocument(doc);
      }
      vscode.workspace.getConfiguration(CONFIG_KEY).update('previouslySelectedFiles', selectedFiles, vscode.ConfigurationTarget.Workspace);    
    }
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files: string[] = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach((file: string) => {
    const absolute: string = path.join(dirPath, file);
    if (fs.statSync(absolute).isDirectory()) {
      arrayOfFiles = getAllFiles(absolute, arrayOfFiles);
    } else if (!absolute.startsWith('Untitled')) {
      arrayOfFiles.push(absolute);
    }
  });
  return arrayOfFiles;
}

function getLanguageName(extension: string): string {
  const langMap: { [key: string]: string } = { 'js': 'JavaScript', 'ts': 'TypeScript', 'py': 'Python', 'java': 'Java', 'c': 'C', 'cpp': 'C++', 'cs': 'C#', 'go': 'Go', 'rb': 'Ruby', 'php': 'PHP', 'kt': 'Kotlin', 'swift': 'Swift', 'rs': 'Rust', 'lua': 'Lua', 'r': 'R', 'sh': 'Shell', 'pl': 'Perl', 'm': 'Objective-C', 'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'json': 'JSON', 'xml': 'XML', 'md': 'Markdown', 'sql': 'SQL', 'yml': 'YAML', 'yaml': 'YAML' };
  return langMap[extension] || extension;
}

function cacheTokenCounts(): void {
  if (statusBar) {
    statusBar.text = `Caching tokens...`;
  }
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;
  const rootPath: string = workspaceFolders[0].uri.fsPath;
  const allFiles: string[] = getAllFiles(rootPath, []);
  for (const filePath of allFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content: string = fs.readFileSync(filePath, 'utf-8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const lang: string = path.extname(filePath).slice(1);
    const languageName: string = getLanguageName(lang);
    const filePrompt: string = `\n---\n\n${filePath}\n\`\`\`${languageName}\n${content}\n\`\`\`\n`;
    const tokens: Uint32Array = encoding.encode(filePrompt);  // Change the type to Uint32Array
    fileTokenCache[filePath] = tokens.length;
  }
  if (statusBar) {
    statusBar.text = `Caching complete`;
  }  
}
