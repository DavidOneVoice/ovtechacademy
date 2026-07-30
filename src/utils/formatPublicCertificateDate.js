const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const formatPublicCertificateDate = (value) => {
  let date;
  if (value?.toDate instanceof Function) date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (Number.isFinite(value?.seconds)) date = new Date(value.seconds * 1000);
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};
