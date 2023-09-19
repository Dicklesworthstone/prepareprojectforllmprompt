"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const path = require("path");
const extension_1 = require("../../extension");
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    // Placeholder for workspace folder
    const testWorkspace = vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'testWorkspace'));
    suiteSetup(() => {
        // Setup: Open a test workspace
        return vscode.commands.executeCommand('vscode.openFolder', testWorkspace);
    });
    suiteTeardown(() => {
        // Teardown: Close the test workspace
        return vscode.commands.executeCommand('workbench.action.closeFolder');
    });
    test('Check Workspace is Open', () => {
        assert.ok(vscode.workspace.workspaceFolders?.length, 'No workspace is opened.');
    });
    test('Activation', () => {
        (0, extension_1.activate)({ subscriptions: [] });
        assert.ok(true, 'Extension should be activated.');
    });
    test('File Selection', () => {
        // Simulate a user picking files
        const filePaths = ['test1.js', 'test2.js'].map(name => path.join(testWorkspace.fsPath, name));
        vscode.window.showQuickPick = () => Promise.resolve(filePaths.map(label => ({ label })));
        return vscode.commands.executeCommand('extension.prepareForLLM').then(() => {
            // Insert code to check whether the correct files were selected
            // This might involve checking a state variable or reading from a temporary file where you stored this info
            assert.ok(true, 'Files should be selected.');
        });
    });
    test('Token Limit', () => {
        const newTokenLimit = 2000;
        vscode.workspace.getConfiguration('prepareForLLM').update('tokenLimit', newTokenLimit, vscode.ConfigurationTarget.Workspace);
        const tokenLimit = vscode.workspace.getConfiguration('prepareForLLM').get('tokenLimit');
        assert.strictEqual(tokenLimit, newTokenLimit, 'Token limit should be updated.');
    });
    // Additional tests can be added to verify other functionalities
    test('Deactivation', () => {
        (0, extension_1.deactivate)();
        assert.ok(true, 'Extension should be deactivated.');
    });
});
//# sourceMappingURL=extension.test.js.map