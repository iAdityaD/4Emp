import { z } from "zod";
export function userMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return issue
      ? `${issue.path.join(" ").replaceAll("_minor", "").replaceAll("_", " ")}: ${issue.message}`
      : "Check your values";
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint"))
    return "A record already exists for this date or category.";
  if (message.includes("FOREIGN KEY"))
    return "Choose an available account and category.";
  if (/database is locked|SQLITE_BUSY/.test(message))
    return "The database is busy. Try again in a moment.";
  return message;
}
