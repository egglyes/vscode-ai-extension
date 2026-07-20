import * as vscode from "vscode";
import { ChatViewProvider } from "./chatView";

const OLLAMA_URL = "http://172.16.49.129:11434/api/generate";

export function activate(context: vscode.ExtensionContext) {
  const baseUrl =
    vscode.workspace
      .getConfiguration("aiFixer")
      .get<string>("ollamaUrl") ?? OLLAMA_URL;

  const chatProvider = new ChatViewProvider(context, baseUrl);

  const chatView = vscode.window.registerWebviewViewProvider(
    ChatViewProvider.viewId,
    chatProvider
  );

  const openChat = vscode.commands.registerCommand("aiFixer.openChat", () => {
    vscode.commands.executeCommand(`${ChatViewProvider.viewId}.focus`);
  });

  // React to settings changes
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("aiFixer.ollamaUrl")) {
      const newUrl =
        vscode.workspace
          .getConfiguration("aiFixer")
          .get<string>("ollamaUrl") ?? OLLAMA_URL;
      chatProvider.setBaseUrl(newUrl);
    }
  });

  context.subscriptions.push(chatView, openChat, configListener);
}

export function deactivate() {}
