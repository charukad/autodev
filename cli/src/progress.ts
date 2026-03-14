import kleur from "kleur";
import type { CliIo, Spinner } from "./types";

const spinnerFrames = ["-", "\\", "|", "/"];

class TerminalSpinner implements Spinner {
  private frameIndex = 0;
  private timer: NodeJS.Timeout | undefined;
  private active = false;
  private message = "";

  constructor(
    private readonly io: CliIo,
    private readonly color: boolean
  ) {}

  start(text: string): void {
    this.message = text;

    if (!this.io.isInteractive) {
      this.io.stdout.write(`${text}\n`);
      return;
    }

    this.active = true;
    this.render();
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % spinnerFrames.length;
      this.render();
    }, 80);
  }

  update(text: string): void {
    this.message = text;

    if (this.active) {
      this.render();
    }
  }

  succeed(text: string): void {
    this.finish(text, this.color ? kleur.green("OK") : "OK");
  }

  fail(text: string): void {
    this.finish(text, this.color ? kleur.red("ERR") : "ERR");
  }

  stop(): void {
    this.finish(this.message, "");
  }

  private render(): void {
    const frame = spinnerFrames[this.frameIndex];
    this.io.stdout.write(`\r${frame} ${this.message}`);
  }

  private finish(text: string, prefix: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    if (this.io.isInteractive) {
      this.io.stdout.write(`\r${" ".repeat(this.message.length + 4)}\r`);
    }

    const line = prefix ? `${prefix} ${text}` : text;
    if (line.length > 0) {
      this.io.stdout.write(`${line}\n`);
    }

    this.active = false;
  }
}

export function createSpinner(io: CliIo, color: boolean): Spinner {
  return new TerminalSpinner(io, color);
}

export function renderProgressBar(current: number, total: number, width = 24): string {
  if (total <= 0) {
    return `[${"-".repeat(width)}] 0%`;
  }

  const ratio = Math.max(0, Math.min(current / total, 1));
  const filledWidth = Math.round(ratio * width);
  const emptyWidth = Math.max(width - filledWidth, 0);

  return `[${"#".repeat(filledWidth)}${"-".repeat(emptyWidth)}] ${Math.round(ratio * 100)}%`;
}
