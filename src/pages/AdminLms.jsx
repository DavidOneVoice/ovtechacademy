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

const emptyResource = {
  title: "",
  course: "",
  section: "",
  unlockDay: 1,
  fileType: "PDF",
  downloadUrl: "",
  isPublished: false,
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sortLessons = (items) =>
  [...items].sort((a, b) => toNumber(a.globalOrder) - toNumber(b.globalOrder));

const sortResources = (items) =>
  [...items].sort(
    (a, b) =>
      String(a.course || "").localeCompare(String(b.course || "")) ||
      toNumber(a.unlockDay, 1) - toNumber(b.unlockDay, 1) ||
      String(a.section || "").localeCompare(String(b.section || "")) ||
      String(a.title || "").localeCompare(String(b.title || "")),
  );

const AdminLms = () => {
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [studentTracks, setStudentTracks] = useState([]);
  const [resourceForm, setResourceForm] = useState(emptyResource);
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
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveSessionForm, setLiveSessionForm] = useState(emptyLiveSession);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const loadLmsContent = async () => {
    setLoading(true);
    const [
      lessonSnapshot,
      resourceSnapshot,
      liveSessionSnapshot,
      applicationSnapshot,
    ] = await Promise.all([
      getDocs(
        query(collection(db, "curriculum"), orderBy("globalOrder", "asc")),
      ),
      getDocs(
        query(collection(db, "lmsResources"), orderBy("unlockDay", "asc")),
      ),
      getDocs(
        query(collection(db, "liveSessions"), orderBy("sessionDate", "desc")),
      ),
      getDocs(collection(db, "scholarshipApplications")),
    ]);

    setLessons(
      sortLessons(
        lessonSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
      ),
    );
    const lessonData = lessonSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("LESSON COUNT:", lessonData.length);
    console.log("FIRST LESSON:", lessonData[0]);

    setLessons(sortLessons(lessonData));
    setResources(
      sortResources(
        resourceSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
      ),
    );
    const resourceData = resourceSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("RESOURCE COUNT:", resourceData.length);

    setResources(sortResources(resourceData));
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
    loadLmsContent().catch((error) => {
      console.error("LMS management load error:", error);
      showToast("Unable to load LMS content.");
      setLoading(false);
    });
  }, []);

  const courses = useMemo(
    () =>
      [
        ...new Set([
          ...studentTracks,
          ...lessons.map((lesson) => lesson.course).filter(Boolean),
          ...courseCatalog.map((course) => course.title).filter(Boolean),
        ]),
      ].sort(),
    [lessons, studentTracks],
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

  const updateLessonField = (id, field, value) => {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === id ? { ...lesson, [field]: value } : lesson,
      ),
    );
  };

  const saveLesson = async (lesson) => {
    setSavingId(lesson.id);
    await updateDoc(doc(db, "curriculum", lesson.id), {
      title: lesson.title || "",
      youtubeUrl: lesson.youtubeUrl || "",
      isPublished: lesson.isPublished !== false,
    });
    setSavingId("");
    showToast("Lesson saved.");
  };

  const updateResourceField = (id, field, value) => {
    setResources((prev) =>
      prev.map((resource) =>
        resource.id === id ? { ...resource, [field]: value } : resource,
      ),
    );
  };

  const saveResource = async (resource) => {
    setSavingId(resource.id);
    await updateDoc(doc(db, "lmsResources", resource.id), {
      title: resource.title || "",
      fileType: resource.fileType || "",
      downloadUrl: resource.downloadUrl || "",
      isPublished: resource.isPublished !== false,
    });
    setSavingId("");
    showToast("Resource saved.");
  };

  const addResource = async (event) => {
    event.preventDefault();
    const payload = {
      ...resourceForm,
      unlockDay: toNumber(resourceForm.unlockDay, 1),
      isPublished: Boolean(resourceForm.isPublished),
      createdAt: new Date(),
    };
    const created = await addDoc(collection(db, "lmsResources"), payload);
    const createdResource = { id: created.id, ...payload };
    setResources((prev) => sortResources([...prev, createdResource]));

    showToast("Resource added.");

    setResourceForm(emptyResource);
  };

  const removeResource = async (resource) => {
    if (
      !window.confirm(
        `Remove resource "${resource.title || resource.fileName || resource.id}"?`,
      )
    )
      return;
    await deleteDoc(doc(db, "lmsResources", resource.id));
    setResources((prev) => prev.filter((item) => item.id !== resource.id));
    showToast("Resource removed.");
  };

  return (
    <main className="admin-page">
      {toast && <div className="admin-toast">{toast}</div>}
      <section className="admin-header">
        <div>
          <span>OVTech Admin</span>
          <h1>LMS Management</h1>
          <p>
            Edit published lessons and resources without changing protected
            curriculum order fields.
          </p>
        </div>
        <div className="admin-header-actions">
          <a href="/admin" className="admin-home-btn">
            Scholarship Admin
          </a>
          <a href="/lms" className="admin-home-btn">
            Open LMS
          </a>
        </div>
      </section>

      {loading ? (
        <p className="admin-loading">Loading LMS content...</p>
      ) : (
        <>
          <section className="admin-table-card admin-lms-card">
            <h2>Curriculum Lessons</h2>
            <p className="admin-helper-text">
              Order is locked: globalOrder, course, section, and unlockDay are
              visible but not editable.
            </p>
            {lessons.map((lesson) => (
              <article className="admin-lms-row" key={lesson.id}>
                <div className="admin-lms-meta">
                  <strong>#{lesson.globalOrder || "—"}</strong>
                  <span>{lesson.course || "No course"}</span>
                  <span>{lesson.section || lesson.module || "No section"}</span>
                  <span>Day {lesson.unlockDay || 1}</span>
                </div>
                <label>
                  Lesson title
                  <input
                    value={lesson.title || ""}
                    onChange={(e) =>
                      updateLessonField(lesson.id, "title", e.target.value)
                    }
                  />
                </label>
                <label>
                  YouTube link
                  <input
                    value={lesson.youtubeUrl || ""}
                    onChange={(e) =>
                      updateLessonField(lesson.id, "youtubeUrl", e.target.value)
                    }
                  />
                </label>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={lesson.isPublished !== false}
                    onChange={(e) =>
                      updateLessonField(
                        lesson.id,
                        "isPublished",
                        e.target.checked,
                      )
                    }
                  />{" "}
                  Published
                </label>
                <button
                  className="admin-view-btn"
                  onClick={() => saveLesson(lesson)}
                  disabled={savingId === lesson.id}
                >
                  {savingId === lesson.id ? "Saving..." : "Save Lesson"}
                </button>
              </article>
            ))}
          </section>

          <section className="admin-table-card admin-lms-card">
            <h2>Upload Live Session</h2>
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
            <h2>Live Sessions</h2>
            {liveSessions.map((session) => (
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
                <label>
                  Title
                  <input
                    value={session.title || ""}
                    onChange={(e) =>
                      setLiveSessions((prev) =>
                        prev.map((item) =>
                          item.id === session.id
                            ? { ...item, title: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={session.sessionDate || ""}
                    onChange={(e) =>
                      setLiveSessions((prev) =>
                        prev.map((item) =>
                          item.id === session.id
                            ? { ...item, sessionDate: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Session URL
                  <input
                    value={session.youtubeUrl || ""}
                    onChange={(e) =>
                      setLiveSessions((prev) =>
                        prev.map((item) =>
                          item.id === session.id
                            ? { ...item, youtubeUrl: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Attachment URL
                  <input
                    value={
                      session.attachmentUrl &&
                      !String(session.attachmentUrl).startsWith("data:")
                        ? session.attachmentUrl
                        : ""
                    }
                    onChange={(e) =>
                      setLiveSessions((prev) =>
                        prev.map((item) =>
                          item.id === session.id
                            ? { ...item, attachmentUrl: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={session.isPublished !== false}
                    onChange={(e) =>
                      setLiveSessions((prev) =>
                        prev.map((item) =>
                          item.id === session.id
                            ? { ...item, isPublished: e.target.checked }
                            : item,
                        ),
                      )
                    }
                  />{" "}
                  Published
                </label>
                <div className="admin-actions">
                  <button
                    className="admin-view-btn"
                    onClick={async () => {
                      setSavingId(session.id);
                      await updateDoc(doc(db, "liveSessions", session.id), {
                        title: session.title || "",
                        sessionDate: session.sessionDate || "",
                        youtubeUrl: session.youtubeUrl || "",
                        attachmentUrl: session.attachmentUrl || "",
                        attachmentName: session.attachmentName || "",
                        isPublished: session.isPublished !== false,
                        audienceType: session.audienceType || "all",
                        learningMode: session.learningMode || "",
                        track: session.track || "all",
                        updatedAt: new Date(),
                      });
                      setSavingId("");
                      showToast("Live session saved.");
                    }}
                  >
                    {savingId === session.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="admin-delete"
                    onClick={() => removeLiveSession(session)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </section>
          <section className="admin-table-card admin-lms-card">
            <h2>Add Resource</h2>
            <form className="admin-lms-form" onSubmit={addResource}>
              <input
                placeholder="Resource title"
                value={resourceForm.title}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                required
              />
              <select
                value={resourceForm.course}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    course: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course}>{course}</option>
                ))}
              </select>
              <input
                placeholder="Section"
                value={resourceForm.section}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    section: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                min="1"
                placeholder="Unlock day"
                value={resourceForm.unlockDay}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    unlockDay: e.target.value,
                  }))
                }
              />
              <input
                placeholder="File type"
                value={resourceForm.fileType}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    fileType: e.target.value,
                  }))
                }
              />
              <input
                placeholder="Download URL"
                value={resourceForm.downloadUrl}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    downloadUrl: e.target.value,
                  }))
                }
              />
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={resourceForm.isPublished}
                  onChange={(e) =>
                    setResourceForm((prev) => ({
                      ...prev,
                      isPublished: e.target.checked,
                    }))
                  }
                />{" "}
                Published
              </label>
              <button className="admin-approve">Add Resource</button>
            </form>
          </section>

          <section className="admin-table-card admin-lms-card">
            <h2>Resources</h2>
            {resources.map((resource) => (
              <article className="admin-lms-row" key={resource.id}>
                <div className="admin-lms-meta">
                  <span>{resource.course || "No course"}</span>
                  <span>{resource.section || "No section"}</span>
                  <span>Day {resource.unlockDay || 1}</span>
                </div>
                <label>
                  Resource title
                  <input
                    value={resource.title || resource.fileName || ""}
                    onChange={(e) =>
                      updateResourceField(resource.id, "title", e.target.value)
                    }
                  />
                </label>
                <label>
                  File type
                  <input
                    value={resource.fileType || ""}
                    onChange={(e) =>
                      updateResourceField(
                        resource.id,
                        "fileType",
                        e.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Download URL
                  <input
                    value={resource.downloadUrl || ""}
                    onChange={(e) =>
                      updateResourceField(
                        resource.id,
                        "downloadUrl",
                        e.target.value,
                      )
                    }
                  />
                </label>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={resource.isPublished !== false}
                    onChange={(e) =>
                      updateResourceField(
                        resource.id,
                        "isPublished",
                        e.target.checked,
                      )
                    }
                  />{" "}
                  Published
                </label>
                <div className="admin-actions">
                  <button
                    className="admin-view-btn"
                    onClick={() => saveResource(resource)}
                    disabled={savingId === resource.id}
                  >
                    {savingId === resource.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="admin-delete"
                    onClick={() => removeResource(resource)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
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

export default AdminLms;
