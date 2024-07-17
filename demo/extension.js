const vscode = require('vscode');

function activate(context) {
  const iconPath = context.asAbsolutePath('resources/logo.png');
  console.log(`Icon path: ${iconPath}`);

  const classDecorationType = vscode.window.createTextEditorDecorationType({
    gutterIconPath: iconPath,
    gutterIconSize: 'contain'
  });

  let currentPanel = undefined;
  let codeLenses = []; // Initialize codeLenses array here

  const updateDecorations = (editor) => {
    if (!editor) {
      console.log('No active editor');
      return;
    }
    const text = editor.document.getText();
    const classRegex = /\bclass\b\s+\w+/g;
    const decorationsArray = [];
    codeLenses = []; // Clear codeLenses array before recreating

    let match;
    while ((match = classRegex.exec(text))) {
      const startPos = editor.document.positionAt(match.index);
      const endPos = editor.document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      const decoration = {
        range: range,
        hoverMessage: 'Click to show options',
      };
      decorationsArray.push(decoration);

      // Adding CodeLens for click interaction
      codeLenses.push({
        range: range,
        command: {
          title: 'Show Options',
          command: 'extension.showOptions',
          arguments: [editor.document.uri, range]
        }
      });
    }

    console.log(`Found ${decorationsArray.length} classes`);
    editor.setDecorations(classDecorationType, decorationsArray);

    // Apply CodeLens
    const codeLensProvider = {
      provideCodeLenses(document, token) {
        return codeLenses;
      },
      resolveCodeLens(codeLens, token) {
        return codeLens;
      }
    };
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ language: 'java' }, codeLensProvider)
    );
  };

  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    updateDecorations(activeEditor);
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        updateDecorations(editor);
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        updateDecorations(activeEditor);
      }
    },
    null,
    context.subscriptions
  );

  // Register the command only once and push it to the context subscriptions
  const showOptionsCommand = vscode.commands.registerCommand('extension.showOptions', (uri, range) => {
    vscode.window.showQuickPick(['Show Testable Methods'], {
      placeHolder: 'Select an option'
    }).then(selection => {
      if (selection === 'Show Testable Methods') {
        showTestableMethods(uri, range);
      }
    });
  });
  context.subscriptions.push(showOptionsCommand);

  function showTestableMethods(uri, range) {
    vscode.workspace.openTextDocument(uri).then((document) => {
      const classStart = document.offsetAt(range.start);
      const classEnd = findClassEnd(document, classStart);
      const classText = document.getText(new vscode.Range(range.start, document.positionAt(classEnd)));
      const methodRegex = /\b(?:public|protected|private|static|\s)+ [a-zA-Z<>\[\]]+\s+(\w+) *\([^)]*\) *(\{?|[^;])/g;
      const methods = [];
      let match;

      while ((match = methodRegex.exec(classText))) {
        methods.push(match[1]);
      }

      if (!currentPanel) {
        currentPanel = vscode.window.createWebviewPanel(
          'testableMethods',
          'Testable Methods',
          vscode.ViewColumn.One,
          {}
        );
        context.subscriptions.push(currentPanel);

        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
      }

      currentPanel.webview.html = getWebviewContent(methods);
    });
  }

  function findClassEnd(document, startOffset) {
    const text = document.getText();
    const classText = text.slice(startOffset);
    let openBraces = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < classText.length; i++) {
      const char = classText[i];
      if (inString) {
        if (char === stringChar) {
          inString = false;
        }
      } else {
        if (char === '{') {
          openBraces++;
        } else if (char === '}') {
          openBraces--;
          if (openBraces === 0) {
            return startOffset + i + 1;
          }
        } else if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        }
      }
    }
    return text.length; // fallback to the end of the document
  }

  function getWebviewContent(methods) {
    return `
      <html>
      <body>
        <h1>Testable Methods</h1>
        <ul>
          ${methods.map(method => `<li>${method}</li>`).join('')}
        </ul>
      </body>
      </html>`;
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
