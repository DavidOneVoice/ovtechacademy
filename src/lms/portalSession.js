import { portalRequest, requirePortalStudent } from "./portalClient.js";

// Every identity change invalidates work started by the previous portal session,
// including logging back into the same enrollment after signing out.
export function createPortalSessionScope() {
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    capture() {
      const current = generation;
      return () => generation === current;
    },
  };
}

export async function recheckPortalSession({ student, pinRequired, signal, isCurrent, request = portalRequest }) {
  const current = () => !signal?.aborted && isCurrent();
  try {
    const session = requirePortalStudent(await request("restore", {}, signal));
    if (!current()) return { stage: "stale" };
    if (session.student.id !== student.id) {
      return { stage: "expired", message: "Your portal session changed. Please sign in again." };
    }
    const unchanged = session.pinRequired === pinRequired && JSON.stringify(session.student) === JSON.stringify(student);
    return unchanged ? { stage: "unchanged" } : { stage: "updated", session };
  } catch (error) {
    if (!current()) return { stage: "stale" };
    if (error.status === 401) {
      return { stage: "expired", message: "Your portal session has ended. Please sign in again with your student PIN if you have one." };
    }
    return { stage: "error", message: error.message || "We could not check your portal session. Please try again." };
  }
}
