export const inr = (n: number, dp = 0) =>
  `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;

export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** "13:35" -> "1:35 PM" */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Short reason a merchant was ruled out, for map labels and chips. */
export function shortFail(rule: string, detail: string): string {
  switch (rule) {
    case "Open now":
      return detail === "closed today" ? "closed today" : "closed now";
    case "Owner's offer window":
      return `offers ${detail.replace("only ", "").split(" to ")[0]} on`;
    case "In stock":
      return "sold out";
    case "Walkable":
      return "too far";
    case "Fits free time":
      return "no time";
    case "Discount allowed":
      return "no discount";
    default:
      return rule.toLowerCase();
  }
}
