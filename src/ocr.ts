import Tesseract, { type Worker } from "tesseract.js";

export class Ocr {
  private workerPromise?: Promise<Worker>;

  constructor(private lang: string = "eng") {}

  private async getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = Tesseract.createWorker(this.lang);
    }
    return this.workerPromise;
  }

  async transcribe(image: Buffer | string): Promise<string> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image);
    return data.text;
  }

  async dispose(): Promise<void> {
    if (!this.workerPromise) {
      return;
    }
    const worker = await this.workerPromise;
    this.workerPromise = undefined;
    await worker.terminate();
  }
}
