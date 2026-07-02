export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getStudentProgramDay = (student, now = new Date()) => {
  const startDate = toDate(student?.lmsStartedAt) || toDate(student?.enrolledAt) || toDate(student?.createdAt) || now;
  const elapsed = Math.floor((now.getTime() - startDate.getTime()) / DAY_IN_MS);
  return Math.max(1, elapsed + 1);
};

export const isItemUnlocked = (item, student, now = new Date()) => {
  const unlockDay = Number(item?.unlockDay || 1);
  return unlockDay <= getStudentProgramDay(student, now);
};

export const sortLmsItems = (items) =>
  [...items].sort((a, b) => {
    const dayDiff = Number(a.unlockDay || 1) - Number(b.unlockDay || 1);
    if (dayDiff) return dayDiff;
    const sectionDiff = String(a.section || a.module || "").localeCompare(String(b.section || b.module || ""));
    if (sectionDiff) return sectionDiff;
    if (a.type !== b.type) return a.type === "resource" ? -1 : 1;
    return Number(a.globalOrder || a.lessonOrder || 0) - Number(b.globalOrder || b.lessonOrder || 0);
  });
