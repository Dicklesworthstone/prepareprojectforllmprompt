/* eslint-disable curly */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';
import { get_encoding } from "@dqbd/tiktoken";

const encoding = get_encoding("gpt2");
const CONFIG_KEY = 'prepareForLLM';
let statusBar: vscode.StatusBarItem | null = null;
let fileTokenCache: { [filePath: string]: number } = {};
let ig = ignore();
let watcher: vscode.FileSystemWatcher | undefined;

async function loadGitIgnore(rootPath: string) {
  try {
    const gitIgnoreContent = await fsp.readFile(path.join(rootPath, '.gitignore'), 'utf8');
    ig = ignore().add(gitIgnoreContent.split(/\r?\n/));
  } catch (e) {
    console.error("Could not load .gitignore:", e);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const rootPath = workspaceFolders[0].uri.fsPath;
    loadGitIgnore(rootPath)
      .then(() => cacheTokenCounts(rootPath))
      .catch(err => console.error("Error initializing extension:", err));
  }
  const disposable = vscode.commands.registerCommand('extension.prepareForLLM', () => {
    (async () => {
      let tokenLimit = vscode.workspace.getConfiguration(CONFIG_KEY).get('tokenLimit', 7500);
      let exclusionList = vscode.workspace.getConfiguration(CONFIG_KEY).get('exclusions', ['node_modules', '.git']);
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showInformationMessage('No workspace is opened.');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      let allFiles = await getAllFiles(rootPath,);
      const initialChoice = await vscode.window.showQuickPick(['Choose All Files', 'Choose Individual Files', 'Choose Which File Extensions to Select', 'Change Max Tokens'], { placeHolder: 'Select method of file selection' });
      if (!initialChoice) { return; }
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


    if (initialChoice === 'Change Max Tokens') {
      const newTokenLimit = await vscode.window.showInputBox({
        prompt: 'Enter a new Max Tokens value (2000-50000)',
        validateInput: (input) => {
          const value = Number(input);
          if (isNaN(value) || value < 2000 || value > 50000) {
            return 'Please enter a number between 2000 and 50000.';
          }
          return null;
        }
      });

      if (newTokenLimit !== undefined) {
        const newTokenLimitNum = Number(newTokenLimit);
        await vscode.workspace.getConfiguration(CONFIG_KEY).update('tokenLimit', newTokenLimitNum, vscode.ConfigurationTarget.Workspace);
        return;
      }
    }

    if (initialChoice === 'Choose Individual Files') {
      const filteredFiles = allFiles
      .filter(filePath => getLanguageName(path.extname(filePath).slice(1)) !== undefined)
      .filter(filePath => {
        const relPath = path.relative(rootPath, filePath);
        return !ig.ignores(relPath);
      });
      const choices: { label: string, picked: boolean }[] = filteredFiles
      .filter(filePath => fileTokenCache[filePath] > 0)
      .map(filePath => {
        const tokenCount = fileTokenCache[filePath] || 0;
        return { label: `${filePath} (${tokenCount} tokens)`, picked: previouslySelectedFiles.includes(filePath) };
      });
    
  
      const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
      quickPick.items = choices;
      quickPick.canSelectMany = true;
      quickPick.placeholder = 'Select individual files';
      const previouslySelectedItems = choices.filter(item => previouslySelectedFiles.includes(item.label.split(" ")[0]));
      quickPick.selectedItems = previouslySelectedItems;

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
      const filteredFiles = allFiles
      .filter(filePath => getLanguageName(path.extname(filePath).slice(1)) !== undefined)
      .filter(filePath => {
        const relPath = path.relative(rootPath, filePath);
        return !ig.ignores(relPath);
      });
      const availableExtensions: string[] = Array.from(new Set(filteredFiles
        .filter(filePath => fileTokenCache[filePath] > 0)
        .map((file: string) => path.extname(file))
      ));
      const selectedExtensions = await vscode.window.showQuickPick(availableExtensions, { canPickMany: true, placeHolder: 'Select file extension(s)' }) || [];
      selectedFiles = allFiles.filter((file: string) => selectedExtensions.includes(path.extname(file)));
    }
    if (selectedFiles.length === 0) {return;}
    let langSet: Set<string> = new Set();
    let prompt: string = '';
    let currentTokens: number = 0;
    let totalSize: number = 0;
    let batch: string[] = [];
    let currentBatchTokens: number = 0;
    for (const filePath of selectedFiles) {
      if (exclusionList.some((ex: string) => filePath.includes(ex)) || !fs.existsSync(filePath) || filePath.startsWith('Untitled')) {continue;}
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
    watcher = vscode.workspace.createFileSystemWatcher("**/*.*");
    watcher.onDidChange(async (uri) => {
      const filePath = uri.fsPath;
      const relPath = path.relative(rootPath, filePath);
      const ext = path.extname(filePath).slice(1);
      const langName = getLanguageName(ext);

      if (!ig.ignores(relPath) && langName) {
        const content = await fsp.readFile(filePath, 'utf-8');
        const sanitizedContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const filePrompt = `\n---\n\n${filePath}\n\`\`\`${langName}\n${sanitizedContent}\n\`\`\`\n`;
        const tokens = encoding.encode(filePrompt);
        fileTokenCache[filePath] = tokens.length;
      }
    });
    watcher.onDidDelete((uri) => {
      const filePath = uri.fsPath;
      delete fileTokenCache[filePath];
    });
  })();
});
if (watcher) {
  context.subscriptions.push(watcher);
}
context.subscriptions.push(disposable);
}

export function deactivate() {
  if (statusBar) {
    statusBar.dispose();
  }
  if (watcher) {
    watcher.dispose();
  }
}

async function getAllFiles(dirPath: string): Promise<string[]> {
  const arrayOfFiles: string[] = [];
  try {
    const files = await fsp.readdir(dirPath);
    await Promise.all(files.map(async file => {
      const absolute = path.join(dirPath, file);
      try {
        if ((await fsp.stat(absolute)).isDirectory()) {
          const subFiles = await getAllFiles(absolute);
          arrayOfFiles.push(...subFiles);
        } else {
          arrayOfFiles.push(absolute);
        }
      } catch (err) {
        console.warn(`Skipping file/directory ${absolute} due to error: ${err}`);
      }
    }));
  } catch (err) {
    console.warn(`Skipping directory ${dirPath} due to error: ${err}`);
  }
  return arrayOfFiles;
}

function getLanguageName(extension: string): string {
  const langMap: { [key: string]: string } = { 'js': 'JavaScript', 'ts': 'TypeScript', 'py': 'Python', 'java': 'Java', 'c': 'C', 'cpp': 'C++', 'cs': 'C#', 'go': 'Go', 'rb': 'Ruby', 'php': 'PHP', 'kt': 'Kotlin', 'swift': 'Swift', 'rs': 'Rust', 'lua': 'Lua', 'r': 'R', 'sh': 'Shell', 'pl': 'Perl', 'm': 'Objective-C', 'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'json': 'JSON', 'xml': 'XML', 'md': 'Markdown', 'sql': 'SQL', 'yml': 'YAML', 'yaml': 'YAML' };
  return langMap[extension] || extension;
}

async function cacheTokenCounts(rootPath: string): Promise<void> {
  if (statusBar) statusBar.text = `Caching tokens...`;
  const allFiles: string[] = await getAllFiles(rootPath);
  for (const filePath of allFiles) {
    const relPath = path.relative(rootPath, filePath);
    if (ig.ignores(relPath)) continue; // Skip files matching .gitignore
    const ext = path.extname(filePath).slice(1);
    if (!getLanguageName(ext)) continue; // Skip files not in langMap
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      const sanitizedContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const lang = getLanguageName(ext);
      const filePrompt = `\n---\n\n${filePath}\n\`\`\`${lang}\n${sanitizedContent}\n\`\`\`\n`;
      const tokens = encoding.encode(filePrompt);
      fileTokenCache[filePath] = tokens.length;
    } catch (err) {
      console.warn(`Could not read file ${filePath} due to error: ${err}`);
    }
  }
  if (statusBar) statusBar.text = `Caching complete`;
}

