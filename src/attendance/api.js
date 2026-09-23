export async function attendanceRequest(action, data = {}, signal) {
  const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Attendance could not be loaded. Please try again.');
  return result;
}
