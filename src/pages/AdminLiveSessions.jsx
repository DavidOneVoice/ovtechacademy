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
import courseCatalog from "../data/courses";
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
};

const AdminLiveSessions = () => {
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveSessionForm, setLiveSessionForm] = useState(emptyLiveSession);
  const [studentTracks, setStudentTracks] = useState([]);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const loadLiveSessions = async () => {
    setLoading(true);
    const [liveSessionSnapshot, applicationSnapshot] = await Promise.all([
      getDocs(
        query(collection(db, "liveSessions"), orderBy("sessionDate", "desc")),
      ),
      getDocs(collection(db, "scholarshipApplications")),
    ]);

    setLiveSessions(
      liveSessionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    );

    const enrolledTracks = applicationSnapshot.docs
      .map((item) => item.data())
      .filter((student) =>
        [student.status, student.paymentStatus, student.enrollmentStatus]
          .join(" ")
          .toLowerCase()
          .match(/enrolled|paid|approved|successful/),
      )
      .flatMap((student) => [
        student.track,
        student.course,
        student.courseName,
        ...(Array.isArray(student.tracks) ? student.tracks : []),
      ])
      .filter(Boolean);

    setStudentTracks([...new Set(enrolledTracks)].sort());
    setLoading(false);
  };

  useEffect(() => {
    loadLiveSessions().catch((error) => {
      console.error("Live session management load error:", error);
      showToast("Unable to load live sessions.");
      setLoading(false);
    });
  }, []);

  const courses = useMemo(
    () =>
      [
        ...new Set([
          ...studentTracks,
          ...courseCatalog.map((course) => course.title).filter(Boolean),
        ]),
      ].sort(),
    [studentTracks],
  );

  const saveLiveAttachment = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve({ attachmentName: "", attachmentUrl: "" });
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ attachmentName: file.name, attachmentUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const persistLiveSession = async (isPublished, audienceOverrides = {}) => {
    if (
      !liveSessionForm.title.trim() ||
      !liveSessionForm.youtubeUrl.trim() ||
      !liveSessionForm.sessionDate
    ) {
      showToast("Add a title, date, and session URL.");
      return;
    }

    const payload = {
      ...liveSessionForm,
      ...audienceOverrides,
      isPublished,
      updatedAt: new Date(),
    };
    delete payload.id;

    if (liveSessionForm.id) {
      await updateDoc(doc(db, "liveSessions", liveSessionForm.id), payload);
      setLiveSessions((prev) =>
        prev.map((item) =>
          item.id === liveSessionForm.id ? { ...item, ...payload } : item,
        ),
      );
      showToast(isPublished ? "Live session updated." : "Draft saved.");
    } else {
      payload.createdAt = new Date();
      const created = await addDoc(collection(db, "liveSessions"), payload);
      setLiveSessions((prev) => [{ id: created.id, ...payload }, ...prev]);
      showToast(isPublished ? "Live session published." : "Draft saved.");
    }

    setLiveSessionForm(emptyLiveSession);
    setPublishModalOpen(false);
  };

  const removeLiveSession = async (session) => {
    if (!window.confirm(`Remove live session "${session.title}"?`)) return;
    await deleteDoc(doc(db, "liveSessions", session.id));
    setLiveSessions((prev) => prev.filter((item) => item.id !== session.id));
    showToast("Live session removed.");
  };

  const editLiveSession = (session) => {
    setLiveSessionForm({ ...emptyLiveSession, ...session });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const viewLiveSession = (session) => {
    if (session.youtubeUrl) {
      window.open(session.youtubeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="admin-page">
      {toast && <div className="admin-toast">{toast}</div>}
      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>Publish Live Sessions</h1>
          <p>
            Publish, view, edit, update, and delete live-session videos from one
            dedicated page.
          </p>
        </div>
        <div className="admin-header-actions">
          <a href="/admin" className="admin-home-btn">
            Scholarship Admin
          </a>
          <a href="/admin/lms" className="admin-home-btn">
            LMS Management
          </a>
          <a href="/lms" className="admin-home-btn">
            Open LMS
          </a>
        </div>
      </section>

      {loading ? (
        <p className="admin-loading">Loading live sessions...</p>
      ) : (
        <>
          <section className="admin-table-card admin-lms-card">
            <h2>{liveSessionForm.id ? "Edit Live Session" : "Publish New Live Video"}</h2>
            <p className="admin-helper-text">
              Publish a YouTube live/replay link to all students, live-class
              learners, self-paced learners, or a specific track.
            </p>
            <form
              className="admin-lms-form admin-live-session-form"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                placeholder="Session title"
                value={liveSessionForm.title}
                onChange={(e) =>
                  setLiveSessionForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />
              <input
                type="date"
                value={liveSessionForm.sessionDate}
                onChange={(e) =>
                  setLiveSessionForm((prev) => ({
                    ...prev,
                    sessionDate: e.target.value,
                  }))
                }
              />
              <input
                placeholder="YouTube or live-session URL"
                value={liveSessionForm.youtubeUrl}
                onChange={(e) =>
                  setLiveSessionForm((prev) => ({
                    ...prev,
                    youtubeUrl: e.target.value,
                  }))
                }
              />
              <input
                placeholder="Optional attachment URL"
                value={
                  liveSessionForm.attachmentUrl &&
                  !String(liveSessionForm.attachmentUrl).startsWith("data:")
                    ? liveSessionForm.attachmentUrl
                    : ""
                }
                onChange={(e) =>
                  setLiveSessionForm((prev) => ({
                    ...prev,
                    attachmentUrl: e.target.value,
                    attachmentName: e.target.value ? prev.attachmentName : "",
                  }))
                }
              />
              <input
                type="file"
                onChange={async (e) => {
                  const attachment = await saveLiveAttachment(
                    e.target.files?.[0],
                  );

                  setLiveSessionForm((prev) => ({
                    ...prev,
                    ...attachment,
                  }));
                }}
              />
              {liveSessionForm.attachmentName && (
                <small>Attached: {liveSessionForm.attachmentName}</small>
              )}
              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-reset-btn"
                  onClick={() => persistLiveSession(false)}
                >
                  Save as Draft
                </button>
                {liveSessionForm.id && (
                  <button
                    type="button"
                    className="admin-reset-btn"
                    onClick={() => setLiveSessionForm(emptyLiveSession)}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  className="admin-approve"
                  onClick={() => {
                    if (
                      !liveSessionForm.title.trim() ||
                      !liveSessionForm.youtubeUrl.trim() ||
                      !liveSessionForm.sessionDate
                    ) {
                      showToast(
                        "Add a title, date, and session URL before publishing.",
                      );
                      return;
                    }
                    setPublishModalOpen(true);
                  }}
                >
                  Upload / Publish
                </button>
              </div>
            </form>
          </section>

          <section className="admin-table-card admin-lms-card">
            <h2>Published & Draft Live Sessions</h2>
            {liveSessions.length ? (
              liveSessions.map((session) => (
                <article className="admin-lms-row" key={session.id}>
                  <div className="admin-lms-meta">
                    <span>{session.isPublished ? "Published" : "Draft"}</span>
                    <span>{session.sessionDate || "No date"}</span>
                    <span>
                      {session.audienceType === "all"
                        ? "All students"
                        : `${session.learningMode} • ${session.track || "all"}`}
                    </span>
                  </div>
                  <h3>{session.title || "Untitled live session"}</h3>
                  <p className="admin-helper-text">{session.youtubeUrl}</p>
                  <div className="admin-actions">
                    <button
                      className="admin-view-btn"
                      onClick={() => viewLiveSession(session)}
                    >
                      View
                    </button>
                    <button
                      className="admin-view-btn"
                      onClick={() => editLiveSession(session)}
                    >
                      Edit / Update
                    </button>
                    <button
                      className="admin-delete"
                      onClick={() => removeLiveSession(session)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="admin-helper-text">No live sessions have been added yet.</p>
            )}
          </section>
        </>
      )}

      {publishModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-publish-modal">
            <button
              className="admin-modal-close"
              onClick={() => setPublishModalOpen(false)}
            >
              ×
            </button>
            <h2>Who should see this live session?</h2>
            <p className="admin-modal-email">
              Choose the audience before publishing.
            </p>
            <div className="admin-publish-grid">
              <button
                onClick={() =>
                  persistLiveSession(true, {
                    audienceType: "all",
                    learningMode: "",
                    track: "all",
                  })
                }
              >
                All enrolled students
              </button>
              {[
                { key: "live", label: "Live class students" },
                { key: "self-paced", label: "Self-paced learners" },
              ].map((mode) => (
                <div key={mode.key} className="admin-publish-group">
                  <strong>{mode.label}</strong>
                  <button
                    onClick={() =>
                      persistLiveSession(true, {
                        audienceType: "mode",
                        learningMode: mode.key,
                        track: "all",
                      })
                    }
                  >
                    All {mode.label}
                  </button>
                  {courses.map((course) => (
                    <button
                      key={`${mode.key}-${course}`}
                      onClick={() =>
                        persistLiveSession(true, {
                          audienceType: "track",
                          learningMode: mode.key,
                          track: course,
                        })
                      }
                    >
                      {course}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default AdminLiveSessions;
