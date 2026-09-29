export interface UsageInfo {
  questionsPerDay: number;
  questionsLeft: number;
  budgetReached: boolean;
}

// The visitor's remaining questions for today, or null if it couldn't be read.
export async function fetchUsage(): Promise<UsageInfo | null> {
  try {
    const res = await fetch("/api/usage", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<UsageInfo>;
    return typeof data.questionsLeft === "number" && typeof data.questionsPerDay === "number"
      ? { questionsPerDay: data.questionsPerDay, questionsLeft: data.questionsLeft, budgetReached: !!data.budgetReached }
      : null;
  } catch {
    return null;
  }
}
