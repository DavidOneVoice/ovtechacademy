import AdminWorkspace from "../components/AdminWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../src/firebase";
import useAdminCohort from "../hooks/useAdminCohort";
import { cohortLabel } from "../data/cohort";
import { getLiveSessionCohortId } from "../lms/liveSessions";
import { getProgrammeAudienceOptions, normalizeLiveSessionProgramme } from "../lms/programmeViews";
import "./Admin.css";

const emptyLiveSession = {
  title: "",
  sessionDate: "",
  youtubeUrl: "",
  attachmentName: "",
  attachmentUrl: "",
  isPublished: false,
  audienceType: "all",
  learningMode: "",
  track: "all",
  cohortId: "",
};

const AdminLiveSessions = () => {
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveSessionForm, setLiveSessionForm] = useState(emptyLiveSession);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [listMode, setListMode] = useState("cohort");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  // Student-record cohort helpers have a July fallback. Recordings must be explicitly assigned.
  const assignedSessions = useMemo(
    () => liveSessions.filter((session) => getLiveSessionCohortId(session)),
    [liveSessions],
  );
  const cohort = useAdminCohort(assignedSessions);
  const unassignedSessions = liveSessions.filter((session) => !getLiveSessionCohortId(session));
  const visibleSessions = listMode === "unassigned" ? unassignedSessions : cohort.scopedRecords;
  const selectedFormCohort = cohort.cohorts.find((item) => item.id === liveSessionForm.cohortId);
  const labelForCohort = (id) => cohort.cohorts.find((item) => item.id === id)?.label || cohortLabel(id);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const loadLiveSessions = async () => {
    setLoading(true);
    const liveSessionSnapshot = await getDocs(
      query(collection(db, "liveSessions"), orderBy("sessionDate", "desc")),
    );
    setLiveSessions(
      liveSessionSnapshot.docs.map((item) => normalizeLiveSessionProgramme({ id: item.id, ...item.data() })),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadLiveSessions().catch((error) => {
      console.error("Live session management load error:", error);
      showToast("Unable to load live sessions.");
      setLoading(false);
    });
  }, []);

  const courses = useMemo(() => getProgrammeAudienceOptions(), []);

  const changeCohort = (id) => {
    if (saving) return;
    setLiveSessionForm(emptyLiveSession);
    setPublishModalOpen(false);
    setListMode("cohort");
    cohort.setSelectedId(id);
  };

  const saveLiveAttachment = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve({ attachmentName: "", attachmentUrl: "" });
      const reader = new FileReader();
      reader.onload = () => resolve({ attachmentName: file.name, attachmentUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const validateForm = () => {
    if (!selectedFormCohort || !getLiveSessionCohortId(liveSessionForm)) {
      showToast("Select the cohort this recording belongs to before saving or publishing.");
      return false;
    }
    if (!liveSessionForm.title.trim() || !liveSessionForm.youtubeUrl.trim() || !liveSessionForm.sessionDate) {
      showToast("Add a title, date, and session URL.");
      return false;
    }
    return true;
  };

  const persistLiveSession = async (isPublished, audienceOverrides = {}) => {
    if (saving || !validateForm()) return;
    setSaving(true);
    try {
      const payload = normalizeLiveSessionProgramme({
        ...liveSessionForm,
        ...audienceOverrides,
        cohortId: selectedFormCohort.id,
        isPublished,
        updatedAt: new Date(),
      });
      delete payload.id;
      if (liveSessionForm.id) {
        await updateDoc(doc(db, "liveSessions", liveSessionForm.id), payload);
        setLiveSessions((previous) => previous.map((item) => item.id === liveSessionForm.id ? { ...item, ...payload } : item));
      } else {
        payload.createdAt = new Date();
        const created = await addDoc(collection(db, "liveSessions"), payload);
        setLiveSessions((previous) => [{ id: created.id, ...payload }, ...previous]);
      }
      showToast(`${isPublished ? "Recording published" : "Draft saved"} for ${selectedFormCohort.label}.`);
      cohort.setSelectedId(selectedFormCohort.id);
      setListMode("cohort");
      setLiveSessionForm(emptyLiveSession);
      setPublishModalOpen(false);
    } catch (error) {
      console.error("Live session save error:", error);
      showToast("The recording could not be saved. Your changes are still here; please try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeLiveSession = async (session) => {
    if (!window.confirm(`Remove live session "${session.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "liveSessions", session.id));
      setLiveSessions((previous) => previous.filter((item) => item.id !== session.id));
      if (liveSessionForm.id === session.id) setLiveSessionForm(emptyLiveSession);
      showToast("Live session removed.");
    } catch (error) {
      console.error("Live session removal error:", error);
      showToast("The recording could not be removed. Please try again.");
    }
  };

  const editLiveSession = (session) => {
    setPublishModalOpen(false);
    setLiveSessionForm(normalizeLiveSessionProgramme({
      ...emptyLiveSession,
      ...session,
      cohortId: getLiveSessionCohortId(session),
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const viewLiveSession = (session) => {
    if (session.youtubeUrl) window.open(session.youtubeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <AdminWorkspace
      cohort={{ ...cohort, setSelectedId: changeCohort }}
      cohortDescription="Recordings follow the selected cohort. Unassigned recordings need review before students can see them."
      title="Live sessions"
      description="Publish class videos and replays for one cohort and the right student audience."
    ><main className="admin-page">
      {toast && <div className="admin-toast" role="status">{toast}</div>}
      <div className="admin-page-toolbar">
        <p>Each recording is visible only within its assigned cohort. Course and learning-method audiences apply inside that cohort.</p>
        <a target="_blank" rel="noopener noreferrer" href="/lms" className="admin-home-btn">Open student portal ↗</a>
      </div>
      {loading ? <p className="admin-loading">Loading live sessions...</p> : <>
        <section className="admin-table-card admin-lms-card">
          <h2>{liveSessionForm.id ? "Edit Live Session" : "Publish New Live Video"}</h2>
          <p className="admin-helper-text">Choose the recording’s cohort before saving a draft or publishing. Then choose all students in that cohort, a learning method, or a specific course.</p>
          {liveSessionForm.id && !getLiveSessionCohortId(liveSessionForm) && <p className="admin-catalogue-note" role="status">This recording has no assigned cohort. Choose its correct cohort before saving or publishing. Unassigned recordings are hidden from student portals.</p>}
          <form className="admin-lms-form admin-live-session-form" onSubmit={(event) => { event.preventDefault(); persistLiveSession(false); }}>
            <label>Recording cohort (required)
              <select required value={liveSessionForm.cohortId} disabled={saving} onChange={(event) => setLiveSessionForm((previous) => ({ ...previous, cohortId: event.target.value }))}>
                <option value="">Select the recording’s cohort</option>
                {cohort.cohorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>Session title
              <input required placeholder="Session title" value={liveSessionForm.title} disabled={saving} onChange={(event) => setLiveSessionForm((previous) => ({ ...previous, title: event.target.value }))} />
            </label>
            <label>Session date
              <input required type="date" value={liveSessionForm.sessionDate} disabled={saving} onChange={(event) => setLiveSessionForm((previous) => ({ ...previous, sessionDate: event.target.value }))} />
            </label>
            <label>Video or live-session URL
              <input required placeholder="YouTube or live-session URL" value={liveSessionForm.youtubeUrl} disabled={saving} onChange={(event) => setLiveSessionForm((previous) => ({ ...previous, youtubeUrl: event.target.value }))} />
            </label>
            <label>Attachment URL (optional)
              <input placeholder="Optional attachment URL" value={liveSessionForm.attachmentUrl && !String(liveSessionForm.attachmentUrl).startsWith("data:") ? liveSessionForm.attachmentUrl : ""} disabled={saving} onChange={(event) => setLiveSessionForm((previous) => ({ ...previous, attachmentUrl: event.target.value, attachmentName: event.target.value ? previous.attachmentName : "" }))} />
            </label>
            <label>Upload attachment (optional)
              <input type="file" disabled={saving} onChange={async (event) => {
                try {
                  const attachment = await saveLiveAttachment(event.target.files?.[0]);
                  setLiveSessionForm((previous) => ({ ...previous, ...attachment }));
                } catch {
                  showToast("The attachment could not be read. Please choose the file again.");
                }
              }} />
            </label>
            {liveSessionForm.attachmentName && <small>Attached: {liveSessionForm.attachmentName}</small>}
            <div className="admin-actions">
              <button type="submit" className="admin-reset-btn" disabled={saving}>{saving ? "Saving..." : "Save as Draft"}</button>
              {liveSessionForm.id && <button type="button" className="admin-reset-btn" disabled={saving} onClick={() => setLiveSessionForm(emptyLiveSession)}>Cancel Edit</button>}
              <button type="button" className="admin-approve" disabled={saving} onClick={(event) => {
                if (event.currentTarget.form.reportValidity() && validateForm()) setPublishModalOpen(true);
              }}>Upload / Publish</button>
            </div>
          </form>
        </section>

        <section className="admin-table-card admin-lms-card">
          <div className="admin-table-heading">
            <div><h2>Published & Draft Live Sessions</h2><p>{listMode === "unassigned" ? "Review recordings that do not have a cohort. These are hidden from student portals." : `Showing ${cohort.selected.label} recordings only.`} {visibleSessions.length} {visibleSessions.length === 1 ? "recording" : "recordings"}.</p></div>
            <label className="admin-cohort-picker"><span>Show recordings</span><select value={listMode} disabled={saving} onChange={(event) => setListMode(event.target.value)}><option value="cohort">{cohort.selected.label} ({cohort.scopedRecords.length})</option><option value="unassigned">Unassigned recordings ({unassignedSessions.length})</option></select></label>
          </div>
          {visibleSessions.length ? visibleSessions.map((session) => {
            const sessionCohortId = getLiveSessionCohortId(session);
            return <article className="admin-lms-row admin-live-row" key={session.id}>
              <div className="admin-lms-meta">
                <span>{sessionCohortId ? labelForCohort(sessionCohortId) : "Cohort not assigned"}</span>
                <span>{session.isPublished ? sessionCohortId ? "Published" : "Published · hidden until assigned" : "Draft"}</span>
                <span>{session.sessionDate || "No date"}</span>
                <span>{session.audienceType === "all" ? "All students in the assigned cohort" : `${session.learningMode} • ${session.track || "all"}`}</span>
              </div>
              <h3>{session.title || "Untitled live session"}</h3>
              <p className="admin-helper-text">{session.youtubeUrl}</p>
              <div className="admin-actions">
                <button type="button" className="admin-view-btn" disabled={saving} onClick={() => viewLiveSession(session)}>View</button>
                <button type="button" className="admin-view-btn" disabled={saving} onClick={() => editLiveSession(session)}>Edit / Update</button>
                <button type="button" className="admin-delete" disabled={saving} onClick={() => removeLiveSession(session)}>Delete</button>
              </div>
            </article>;
          }) : <p className="admin-helper-text">{listMode === "unassigned" ? "No unassigned recordings need review." : `No live sessions have been added for ${cohort.selected.label} yet.`}</p>}
        </section>
      </>}

      {publishModalOpen && selectedFormCohort && <div className="admin-modal-overlay">
        <div className="admin-modal admin-publish-modal" role="dialog" aria-modal="true" aria-labelledby="live-publish-heading">
          <button type="button" className="admin-modal-close" aria-label="Close dialog" disabled={saving} onClick={() => setPublishModalOpen(false)}>×</button>
          <h2 id="live-publish-heading">Publish to {selectedFormCohort.label}</h2>
          <p className="admin-modal-email">Choose who in the {selectedFormCohort.label} cohort should see this recording. Students in other cohorts will not see it.</p>
          <div className="admin-publish-grid">
            <button type="button" disabled={saving} onClick={() => persistLiveSession(true, { audienceType: "all", learningMode: "", track: "all" })}>All enrolled students in {selectedFormCohort.label}</button>
            {[
              { key: "live", label: "Live class students" },
              { key: "self-paced", label: "Self-paced learners" },
            ].map((mode) => <div key={mode.key} className="admin-publish-group">
              <strong>{mode.label} · {selectedFormCohort.label}</strong>
              <button type="button" disabled={saving} onClick={() => persistLiveSession(true, { audienceType: "mode", learningMode: mode.key, track: "all" })}>All {mode.label.toLowerCase()} in this cohort</button>
              {courses.map((course) => <button type="button" key={`${mode.key}-${course}`} disabled={saving} onClick={() => persistLiveSession(true, { audienceType: "track", learningMode: mode.key, track: course })}>{course}</button>)}
            </div>)}
          </div>
        </div>
      </div>}
    </main></AdminWorkspace>
  );
};

export default AdminLiveSessions;
