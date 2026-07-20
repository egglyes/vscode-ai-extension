import * as vscode from "vscode";
import * as fs from "fs";

const OLLAMA_URL = "http://172.16.49.129:11434/api/generate";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "aiFixer.fixFromImage",
    async () => {
      // 1. Let you pick a screenshot file
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Images: ["png", "jpg", "jpeg"] },
      });
      if (!uris || uris.length === 0) {
        vscode.window.showInformationMessage("No image selected.");
        return;
      }

      const imageBase64 = fs.readFileSync(uris[0].fsPath).toString("base64");

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Reading screenshot with moondream...",
        },
        async () => {
          try {
            const transcription = await callOllama("moondream", imageBase64);
            // For now, just show it in a new untitled doc so we can SEE what moondream returns
            const doc = await vscode.workspace.openTextDocument({
              content: transcription,
              language: "markdown",
            });
            await vscode.window.showTextDocument(doc);
          } catch (err) {
            vscode.window.showErrorMessage(`AI Fixer failed: ${err}`);
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

async function callOllama(model: string, imageBase64: string): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `Transcribe all code visible in this screenshot exactly as written, preserving whitespace and line breaks. Then separately list any visible error messages, red underlines, or IDE warnings and what line they point to.`,
      images: [imageBase64],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { response: string };
  return data.response;
}

export function deactivate() {}
