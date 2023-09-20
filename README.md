# PrepareProjectForLLMPrompt Extension for VS Code

Prepare your code project for interaction with Language Learning Models (LLM) like GPT-4. This extension compiles the code from multiple files into a Markdown document suitable for providing as a prompt to such models.

## Features

- **Batch File Selection**: Select multiple files from your workspace to prepare as LLM input.
- **File Type Filtering**: Easily filter files based on their extension (e.g., `.js`, `.py`).
- **Token Limit**: Set a maximum token limit for the generated Markdown document to ensure compatibility with the LLM.
- **Dynamic Configuration**: Change extension settings like `tokenLimit` on the fly without reloading.

![Demo](images/demo.png)  <!-- Replace with actual screenshot or animated gif -->

## Requirements

- Visual Studio Code 1.58.0 or higher
- Node.js 14 or higher
- The `@dqbd/tiktoken` package for token counting

## Extension Settings

This extension provides the following settings, which can be configured in your workspace or user settings:

- `prepareForLLM.tokenLimit`: The maximum token limit for the generated Markdown document. Default is 7500.
- `prepareForLLM.selectedFiles`: List of selected files to include in the prompt. Defaults to an empty array.
- `prepareForLLM.exclusions`: Directories or files to exclude. Defaults to `['node_modules', '.git']`.
- `prepareForLLM.fileTypeFilter`: List of file extensions to consider. Defaults to `['.js', '.ts', '.py']`.

## Known Issues

- The extension may not handle very large files (> 1MB) effectively.

## Release Notes

### 1.0.0

- Initial release with basic file selection and token counting.

### 1.1.0

- Added dynamic configuration settings.
- Improved error handling and logging.

## Contributing

For guidelines on contributing to this project, please refer to the [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines).

## License

MIT

---

## For More Information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

