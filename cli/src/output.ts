import kleur from "kleur";
import type { CliIo, OutputFormat } from "./types";

type ColumnDefinition = {
  key: string;
  label: string;
};

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function padCell(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(width - value.length, 0))}`;
}

function renderPlainRecord(record: Record<string, unknown>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}: ${stringifyValue(value)}`)
    .join("\n");
}

function renderTable(columns: ColumnDefinition[], rows: Record<string, unknown>[]): string {
  const widths = columns.map((column) =>
    Math.max(column.label.length, ...rows.map((row) => stringifyValue(row[column.key]).length))
  );
  const header = columns
    .map((column, index) => padCell(column.label, widths[index] ?? column.label.length))
    .join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((column, index) =>
        padCell(
          stringifyValue(row[column.key]),
          widths[index] ?? stringifyValue(row[column.key]).length
        )
      )
      .join("  ")
  );

  return [header, divider, ...body].join("\n");
}

export class OutputRenderer {
  constructor(
    private readonly io: CliIo,
    private readonly format: OutputFormat,
    private readonly color: boolean
  ) {}

  writeLine(message = ""): void {
    this.io.stdout.write(`${message}\n`);
  }

  printRecord(title: string, record: Record<string, unknown>): void {
    if (this.format === "json") {
      this.writeLine(JSON.stringify({ title, ...record }, null, 2));
      return;
    }

    if (this.format === "table") {
      const rows = Object.entries(record).map(([key, value]) => ({
        key,
        value: stringifyValue(value),
      }));
      this.writeTitle(title);
      this.writeLine(
        renderTable(
          [
            { key: "key", label: "Field" },
            { key: "value", label: "Value" },
          ],
          rows
        )
      );
      return;
    }

    this.writeTitle(title);
    this.writeLine(renderPlainRecord(record));
  }

  printTable(title: string, columns: ColumnDefinition[], rows: Record<string, unknown>[]): void {
    if (this.format === "json") {
      this.writeLine(JSON.stringify({ title, rows }, null, 2));
      return;
    }

    if (this.format === "plain") {
      this.writeTitle(title);
      for (const row of rows) {
        this.writeLine(renderPlainRecord(row));
        this.writeLine();
      }
      return;
    }

    this.writeTitle(title);
    this.writeLine(renderTable(columns, rows));
  }

  printJson(value: unknown): void {
    this.writeLine(JSON.stringify(value, null, 2));
  }

  printList(title: string, values: string[]): void {
    if (this.format === "json") {
      this.writeLine(JSON.stringify({ title, values }, null, 2));
      return;
    }

    this.writeTitle(title);
    if (values.length === 0) {
      this.writeLine("(none)");
      return;
    }

    for (const value of values) {
      this.writeLine(`- ${value}`);
    }
  }

  writeTitle(title: string): void {
    this.writeLine(this.color ? kleur.bold(title) : title);
  }
}
