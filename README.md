# PrepareProjectForLLMPrompt Extension for VS Code

Transform your small-to-medium scale code project into a Markdown document suitable for interaction with Language Learning Models (LLM) like GPT-4. This extension enables you to select code files in your workspace and compile them into a Markdown-formatted document that can serve as a prompt for LLMs.

## Why This Extension?

- **Code Review with AI**: Perfect for when you want to leverage LLMs for code review or code-related querying.
- **Token Management**: Takes care of token limits for the generated Markdown document to ensure LLM compatibility.
- **Dynamic File Selection**: Offers multiple methods for selecting code files, including individual selection and extension-based filtering.

![Demo](https://github.com/Dicklesworthstone/prepareprojectforllmprompt/raw/master/prepare_for_llm_vscode_extension_demo.gif)

## Features

### File Selection Modes

- **Choose All Files**: Automatically selects all code files in your workspace.
- **Choose Individual Files**: Enables you to select specific files. Your selection is saved for future reference.
- **Choose File Extensions**: Allows you to include files based on their extensions.

### Token Limit and Status Bar

- **Token Counter**: Keeps track of the token count and displays it in the status bar.
- **Token Limit**: Configurable maximum token limit for the generated Markdown output.

### Previous Selections

- **Memory**: Remembers your previous file selection choices and pre-selects them the next time.

## Visual Studio Marketplace

This extension is available on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=JeffreyEmanuel.prepareprojectforllmprompt) for Visual Studio Code.

## Requirements

- Visual Studio Code 1.58.0 or higher
- Node.js 14 or higher
- The `@dqbd/tiktoken` package for token counting

## Installation

1. Install the extension from the Visual Studio Code Marketplace.
2. Install the required Node.js packages.
3. Configure the extension settings if needed.

## Extension Settings

- `prepareForLLM.tokenLimit`: Maximum token limit for the generated Markdown document. Default is 7500.
- `prepareForLLM.exclusions`: Directories or files to exclude. Defaults to `['node_modules', '.git']`.

## How It Works

1. **Initialization**: Once activated, the extension caches token counts for all files in your workspace.
2. **File Selection**: You can choose files individually, select all, or filter by file extensions.
3. **Markdown Compilation**: Selected files are compiled into a Markdown document with the programming language specified for each code block.
4. **Token Management**: The extension ensures that the token count does not exceed the specified limit by breaking the content into batches if necessary.
5. **Output**: A new Markdown document is opened in VS Code containing the compiled code files.

## Known Issues

- The extension may not handle very large files (> 1MB) effectively.

## Release Notes

### 1.0.0

- Initial release with basic functionality.
- Added dynamic configuration settings.
- Improved error handling and logging.
- Added multiple file selection modes.
- Introduced token caching and status bar updates.

## Contributing

For guidelines on contributing to this project, please refer to the [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines).

## License

MIT

---

## For More Information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

