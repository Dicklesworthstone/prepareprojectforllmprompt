"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const tiktoken_1 = require("@dqbd/tiktoken");
const encoding = (0, tiktoken_1.get_encoding)("gpt2");
const CONFIG_KEY = 'prepareForLLM';
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.prepareForLLM', async () => {
        let selectedFiles = vscode.workspace.getConfiguration(CONFIG_KEY).get('selectedFiles', []);
        let exclusionList = vscode.workspace.getConfiguration(CONFIG_KEY).get('exclusions', ['node_modules', '.git']);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showInformationMessage('No workspace is opened.');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        let allFiles = [];
        try {
            allFiles = getAllFiles(rootPath, []);
        }
        catch (err) {
            logError(err);
            vscode.window.showErrorMessage(`Error reading files. Check the error log.`);
            return;
        }
        const availableExtensions = Array.from(new Set(allFiles.map(file => path.extname(file))));
        const selectedExtension = await vscode.window.showQuickPick(availableExtensions, { placeHolder: 'Select file extension' });
        if (!selectedExtension)
            return;
        const filteredFiles = allFiles.filter(file => path.extname(file) === selectedExtension);
        const pickedFiles = await vscode.window.showQuickPick(filteredFiles.map(label => ({ label })), { canPickMany: true });
        if (!pickedFiles)
            return;
        selectedFiles = pickedFiles.map(item => item.label);
        vscode.workspace.getConfiguration(CONFIG_KEY).update('selectedFiles', selectedFiles, true);
        let langSet = new Set();
        let totalSize = 0;
        let tokenLimit = vscode.workspace.getConfiguration(CONFIG_KEY).get('tokenLimit', 4096);
        let batch = [];
        let prompt = '';
        for (const filePath of selectedFiles) {
            if (exclusionList.some(ex => filePath.includes(ex)))
                continue;
            try {
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
                if (totalSize > 1024 * 1024) {
                    vscode.window.showInformationMessage('Files too large to load into memory.');
                    return;
                }
                let content = fs.readFileSync(filePath, 'utf-8');
                content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
                const lang = path.extname(filePath).slice(1);
                const languageName = getLanguageName(lang);
                langSet.add(languageName);
                const tokens = encoding.encode(content);
                if (tokens.length > tokenLimit) {
                    vscode.window.showInformationMessage('Token limit exceeded.');
                    return;
                }
                const filePrompt = `\n---\n\n${filePath}\n\`\`\`${languageName}\n${content}\n\`\`\`\n`;
                if (prompt.length + filePrompt.length > tokenLimit) {
                    batch.push(prompt);
                    prompt = '';
                }
                prompt += filePrompt;
            }
            catch (err) {
                logError(err);
                vscode.window.showErrorMessage(`Error reading file ${filePath}. Check the error log.`);
                return;
            }
        }
        let languagesList = Array.from(langSet).join(", ");
        let preamble = `The following are the various ${languagesList} code files for a project. Each relative file path will be listed, followed by the file contents of that code file in a block:\n\n`;
        batch.unshift(preamble);
        for (const b of batch) {
            try {
                const doc = await vscode.workspace.openTextDocument({ content: b, language: 'markdown' });
                await vscode.window.showTextDocument(doc);
            }
            catch (err) {
                logError(err);
                vscode.window.showErrorMessage(`Error opening document. Check the error log.`);
            }
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(file => {
        const absolute = path.join(dirPath, file);
        if (fs.statSync(absolute).isDirectory()) {
            arrayOfFiles = getAllFiles(absolute, arrayOfFiles);
        }
        else {
            arrayOfFiles.push(absolute);
        }
    });
    return arrayOfFiles;
}
function getLanguageName(extension) {
    const langMap = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'py': 'Python',
        'java': 'Java',
        'c': 'C',
        'cpp': 'C++',
        'cs': 'C#',
        'go': 'Go',
        'rb': 'Ruby',
        'php': 'PHP',
        'kt': 'Kotlin',
        'swift': 'Swift',
        'rs': 'Rust',
        'lua': 'Lua',
        'r': 'R',
        'sh': 'Shell',
        'pl': 'Perl',
        'm': 'Objective-C',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'json': 'JSON',
        'xml': 'XML',
        'md': 'Markdown',
        'sql': 'SQL',
        'yml': 'YAML',
        'yaml': 'YAML'
    };
    return langMap[extension] || extension;
}
function logError(err) {
    fs.appendFileSync('error.log', `[${new Date().toISOString()}] ${err}\n`);
}
//# sourceMappingURL=extension.js.map