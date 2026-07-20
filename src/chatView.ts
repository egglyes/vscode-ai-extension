import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { OllamaClient } from "./ollama";
import { Ocr } from "./ocr";

type WebviewToExt =
  | { type: "ready" }
  | { type: "send"; id: string; text: string; images: string[] }
  | { type: "cancel"; id: string }
  | { type: "pickImage" };

type Stage = "transcribing" | "fixing";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "aiFixer.chatView";

  private view?: vscode.WebviewView;
  private client: OllamaClient;
  private inFlight = new Map<string, AbortController>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    baseUrl: string
  ) {
    this.client = new OllamaClient(baseUrl);
  }

  setBaseUrl(url: string) {
    this.client.setBaseUrl(url);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, "media")),
      ],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: WebviewToExt) =>
      this.handleMessage(msg)
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.postReady();
    });

    webviewView.onDidDispose(() => {
      for (const ctl of this.inFlight.values()) ctl.abort();
      this.inFlight.clear();
      this.view = undefined;
    });
  }

  private postReady() {
    if (!this.view) return;
    const { coderModel } = readModels();
    this.view.webview.postMessage({
      type: "init",
      coderModel,
    });
  }

  private async handleMessage(msg: WebviewToExt) {
    switch (msg.type) {
      case "ready":
        this.postReady();
        break;

      case "pickImage":
        await this.pickImage();
        break;

      case "cancel": {
        const ctl = this.inFlight.get(msg.id);
        if (ctl) {
          ctl.abort();
          this.inFlight.delete(msg.id);
        }
        break;
      }

      case "send":
        await this.runPipeline(msg.id, msg.text, msg.images);
        break;
    }
  }

  private async pickImage() {
    if (!this.view) return;
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { Images: ["png", "jpg", "jpeg", "webp", "gif"] },
    });
    if (!uris || uris.length === 0) return;
    const buf = fs.readFileSync(uris[0].fsPath);
    const ext = path.extname(uris[0].fsPath).slice(1).toLowerCase();
    const mime =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "gif"
        ? "image/gif"
        : ext === "webp"
        ? "image/webp"
        : "image/png";
    this.view.webview.postMessage({
      type: "imagePicked",
      mime,
      base64: buf.toString("base64"),
    });
  }

  private postStatus(id: string, stage: Stage) {
    if (!this.view) return;
    const text =
      stage === "transcribing"
        ? "Reading screenshot…"
        : "Generating fix with my-coder…";
    this.view.webview.postMessage({ type: "status", id, stage, text });
  }

  private async runPipeline(
    id: string,
    text: string,
    images: string[]
  ) {
    if (!this.view) return;
    const ctl = new AbortController();
    this.inFlight.set(id, ctl);

    const { coderModel } = readModels();
    const hasImage = images.length > 0;

    try {
      let promptForCoder: string;
      if (hasImage) {
        // Stage 1: OCR
        this.postStatus(id, "transcribing");
        const ocr = new Ocr("eng");
        try {
          promptForCoder = await ocr.transcribe(
            Buffer.from(images[0], "base64")
          );
        } finally {
          await ocr.dispose();
        }
        if (ctl.signal.aborted) return;
      } else {
        promptForCoder = text;
      }

      // Stage 2: fix
      this.postStatus(id, "fixing");
      for await (const chunk of this.client.streamGenerate({
        model: coderModel,
        prompt: promptForCoder,
        signal: ctl.signal,
      })) {
        if (chunk.response) {
          this.view.webview.postMessage({
            type: "chunk",
            id,
            delta: chunk.response,
          });
        }
      }
      this.view.webview.postMessage({ type: "done", id });
    } catch (err) {
      const aborted = ctl.signal.aborted;
      const message = aborted
        ? "Stopped."
        : err instanceof Error
        ? err.message
        : String(err);
      this.view.webview.postMessage({ type: "error", id, message });
    } finally {
      this.inFlight.delete(id);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, "media", "chat.html");
    return fs.readFileSync(htmlPath, "utf8");
  }
}

function readModels(): { coderModel: string } {
  const cfg = vscode.workspace.getConfiguration("aiFixer");
  return {
    coderModel: cfg.get<string>("coderModel") ?? "my-coder:latest",
  };
}
