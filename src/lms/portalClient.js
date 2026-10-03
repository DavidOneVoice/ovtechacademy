export async function portalRequest(action, data = {}, signal, fetchImpl = fetch) {
  const response = await fetchImpl("/api/portal", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, action }),
    signal,
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("The student portal could not be reached. Please try again."); }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("The student portal could not be reached. Please try again.");
  }
  if (!response.ok) {
    const error = new Error(result.error || "The student portal could not complete your request.");
    error.status = response.status;
    error.code = result.code;
    throw error;
  }
  return result;
}

export function requirePortalStudent(result) {
  if (!result?.student?.id || typeof result.student.id !== "string") {
    throw new Error("We could not confirm your portal session. Please sign in again.");
  }
  return { student: result.student, pinRequired: result.pinRequired === true };
}
