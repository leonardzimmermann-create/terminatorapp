/**
 * Anchor-based period: the window starts at the most recent period boundary
 * that is <= today, where periods are fixed N-month intervals starting from
 * the anchor date (= date of the domain's first send).
 *
 * Example: anchor=2026-03-01, interval=5, today=2026-05-23
 *   → monthsSince=2, completedIntervals=0, periodStart=2026-03-01
 *   → nextPeriodStart=2026-08-01 (reset after 5 months)
 */
export function periodStart(anchor: Date, resetIntervalMonths: number): Date {
  const now = new Date()
  const anchorYear = anchor.getFullYear()
  const anchorMonth = anchor.getMonth()
  const monthsSinceAnchor = (now.getFullYear() - anchorYear) * 12 + (now.getMonth() - anchorMonth)
  const completedIntervals = Math.max(0, Math.floor(monthsSinceAnchor / resetIntervalMonths))
  const offsetMonths = completedIntervals * resetIntervalMonths
  const absMonth = anchorMonth + offsetMonths
  return new Date(anchorYear + Math.floor(absMonth / 12), absMonth % 12, 1)
}

export function nextPeriodStart(anchor: Date, resetIntervalMonths: number): Date {
  const start = periodStart(anchor, resetIntervalMonths)
  const absMonth = start.getMonth() + resetIntervalMonths
  return new Date(start.getFullYear() + Math.floor(absMonth / 12), absMonth % 12, 1)
}
