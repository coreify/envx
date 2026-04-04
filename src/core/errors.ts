export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(formatValidationIssues(issues));
    this.name = "EnvValidationError";
    this.issues = [...issues];
  }
}

export function formatValidationIssues(issues: readonly string[]): string {
  const lines = [
    "❌ Invalid environment variables:",
    "",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "💡 Fix your .env file or environment variables."
  ];

  return lines.join("\n");
}
