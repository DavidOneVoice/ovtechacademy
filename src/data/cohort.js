export const COHORT = {
  id: "october-2026", label: "October 2026", startDate: "2026-10-05",
  startDateLabel: "October 5, 2026", website: "https://ovtechacademy.com",
};

export const LEGACY_COHORT = {
  id: "july-2026", label: "July 2026",
};
export const DEFAULT_COHORTS = [COHORT, LEGACY_COHORT];

// Untagged records are from the academy's original intake. Never infer an
// intake from the date a learner graduates, pays, or last updates a profile.
export const recordCohortId = (record) => record?.cohortId || LEGACY_COHORT.id;
export const belongsToCohort = (record, id) => recordCohortId(record) === id;
export const cohortLink = (path, id) => `${path}?cohort=${encodeURIComponent(id)}`;
export function cohortLabel(id) {
  return DEFAULT_COHORTS.find((item) => item.id === id)?.label ||
    String(id).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
export function sortCohorts(items) {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const date = (item) => {
    if (item.startDate) return Date.parse(item.startDate) || 0;
    const [month, year] = item.id.split("-");
    return months.includes(month) && /^\d{4}$/.test(year || "") ? Date.UTC(Number(year), months.indexOf(month), 1) : 0;
  };
  return [...new Map(items.map((item) => [item.id, item])).values()]
    .sort((a, b) => date(b) - date(a) || b.id.localeCompare(a.id));
}
