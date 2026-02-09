#!/bin/bash

echo "🔨 Building Salesforce Ranger Toolkit Extension..."
echo ""

# Navigate to extension directory
cd "$(dirname "$0")/.vscode/extensions/sf-ranger-toolkit" || exit

# Check if vsce is installed locally
if [ ! -d "node_modules/@vscode/vsce" ]; then
    echo "📦 Installing vsce (VS Code Extension Manager) locally..."
    npm init -y > /dev/null 2>&1
    npm install --save-dev @vscode/vsce
fi

# Package the extension
echo "📦 Packaging extension..."
npx vsce package --allow-missing-repository

# Move the .vsix file to the project root
if [ -f *.vsix ]; then
    mv *.vsix ../../..
    echo ""
    echo "✅ Extension packaged successfully!"
    echo ""
    echo "📦 Installation file created: sf-ranger-toolkit-1.0.0.vsix"
    echo ""
    echo "🚀 To install:"
    echo "   1. Open VS Code"
    echo "   2. Press Cmd+Shift+P"
    echo "   3. Type: 'Extensions: Install from VSIX...'"
    echo "   4. Select: sf-ranger-toolkit-1.0.0.vsix"
    echo "   5. Reload VS Code"
    echo ""
    echo "   OR run: code --install-extension sf-ranger-toolkit-1.0.0.vsix"
    echo ""
else
    echo "❌ Failed to create extension package"
    exit 1
fi

