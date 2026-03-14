import kleur from "kleur";
import type { CliIo, LogLevel } from "./types";

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function formatLevel(level: LogLevel, color: boolean): string {
  const label = level.toUpperCase();

  if (!color) {
    return label;
  }

  if (level === "debug") {
    return kleur.gray(label);
  }

  if (level === "warn") {
    return kleur.yellow(label);
  }

  if (level === "error") {
    return kleur.red(label);
  }

  return kleur.cyan(label);
}

export class Logger {
  constructor(
    private readonly io: CliIo,
    private readonly level: LogLevel,
    private readonly color: boolean
  ) {}

  debug(message: string): void {
    this.write("debug", message);
  }

  info(message: string): void {
    this.write("info", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    this.write("error", message);
  }

  private write(level: LogLevel, message: string): void {
    if (levelWeights[level] < levelWeights[this.level]) {
      return;
    }

    this.io.stderr.write(`[${formatLevel(level, this.color)}] ${message}\n`);
  }
}
