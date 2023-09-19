# Install Node.js and npm
sudo apt update
sudo apt install -y nodejs npm

# Install Yeoman and VS Code Extension Generator
npm install -g yo generator-code

# Create a directory for your VSCode extension and navigate into it
mkdir PrepareProjectForLLMPrompt
cd PrepareProjectForLLMPrompt

# Run the Yeoman generator for a new VS Code extension
yo code

# Install required packages
npm install

# Create the extension TypeScript file
touch src/extension.ts

# Create the package.json settings
touch package.json
