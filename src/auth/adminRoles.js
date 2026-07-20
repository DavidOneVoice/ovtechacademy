export const ADMIN_ROLE_STORAGE_KEY = "ovtechAdminRole";

export const ADMIN_ROLES = {
  ADMIN: "admin",
  ASSISTANT: "assistant",
};

export const getStoredAdminRole = () => {
  const role = localStorage.getItem(ADMIN_ROLE_STORAGE_KEY);

  if (Object.values(ADMIN_ROLES).includes(role)) return role;
  return localStorage.getItem("ovtechAdmin") === "true" ? ADMIN_ROLES.ADMIN : null;
};

export const setStoredAdminRole = (role) => {
  localStorage.setItem("ovtechAdmin", "true");
  localStorage.setItem(ADMIN_ROLE_STORAGE_KEY, role);
};

export const clearStoredAdminRole = () => {
  localStorage.removeItem("ovtechAdmin");
  localStorage.removeItem(ADMIN_ROLE_STORAGE_KEY);
};
