import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
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
  [...items].sort(
    (firstLesson, secondLesson) =>
      toNumber(firstLesson.globalOrder) - toNumber(secondLesson.globalOrder),
  );

const sortResources = (items) =>
  [...items].sort(
    (firstResource, secondResource) =>
      String(firstResource.course || "").localeCompare(
        String(secondResource.course || ""),
      ) ||
      toNumber(firstResource.unlockDay, 1) -
        toNumber(secondResource.unlockDay, 1) ||
      String(firstResource.section || "").localeCompare(
        String(secondResource.section || ""),
      ) ||
      String(firstResource.title || "").localeCompare(
        String(secondResource.title || ""),
      ),
  );

const AdminLms = () => {
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [settings, setSettings] = useState({
    selfPacedStartDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const loadLmsContent = async () => {
    setLoading(true);

    const [lessonSnapshot, resourceSnapshot, settingsSnapshot] =
      await Promise.all([
        getDocs(
          query(collection(db, "curriculum"), orderBy("globalOrder", "asc")),
        ),
        getDocs(
          query(collection(db, "lmsResources"), orderBy("unlockDay", "asc")),
        ),
        getDoc(doc(db, "lmsSettings", "selfPaced")),
      ]);

    const lessonData = lessonSnapshot.docs.map((lesson) => ({
      id: lesson.id,
      ...lesson.data(),
    }));

    const resourceData = resourceSnapshot.docs.map((resource) => ({
      id: resource.id,
      ...resource.data(),
    }));

    const savedSettings = settingsSnapshot.exists()
      ? settingsSnapshot.data()
      : {};

    setLessons(sortLessons(lessonData));
    setResources(sortResources(resourceData));
    setSettings({
      selfPacedStartDate:
        savedSettings.startDate || savedSettings.selfPacedStartDate || "",
    });

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
          ...lessons.map((lesson) => lesson.course).filter(Boolean),
          ...courseCatalog.map((course) => course.title).filter(Boolean),
        ]),
      ].sort(),
    [lessons],
  );

  const updateLessonField = (id, field, value) => {
    setLessons((previousLessons) =>
      previousLessons.map((lesson) =>
        lesson.id === id ? { ...lesson, [field]: value } : lesson,
      ),
    );
  };

  const saveLesson = async (lesson) => {
    setSavingId(lesson.id);

    try {
      await updateDoc(doc(db, "curriculum", lesson.id), {
        title: lesson.title || "",
        youtubeUrl: lesson.youtubeUrl || "",
        isPublished: lesson.isPublished !== false,
      });

      showToast("Lesson saved.");
    } catch (error) {
      console.error("Lesson save error:", error);
      showToast("Lesson could not be saved.");
    } finally {
      setSavingId("");
    }
  };

  const saveSettings = async () => {
    setSavingId("lms-settings");

    try {
      await setDoc(
        doc(db, "lmsSettings", "selfPaced"),
        {
          startDate: settings.selfPacedStartDate || "",
          updatedAt: new Date(),
        },
        { merge: true },
      );

      showToast("Self-paced start date saved.");
    } catch (error) {
      console.error("LMS settings save error:", error);
      showToast("Start date could not be saved.");
    } finally {
      setSavingId("");
    }
  };

  const updateResourceField = (id, field, value) => {
    setResources((previousResources) =>
      previousResources.map((resource) =>
        resource.id === id ? { ...resource, [field]: value } : resource,
      ),
    );
  };

  const saveResource = async (resource) => {
    setSavingId(resource.id);

    try {
      await updateDoc(doc(db, "lmsResources", resource.id), {
        title: resource.title || "",
        fileType: resource.fileType || "",
        downloadUrl: resource.downloadUrl || "",
        isPublished: resource.isPublished !== false,
      });

      showToast("Resource saved.");
    } catch (error) {
      console.error("Resource save error:", error);
      showToast("Resource could not be saved.");
    } finally {
      setSavingId("");
    }
  };

  const addResource = async (event) => {
    event.preventDefault();

    const payload = {
      ...resourceForm,
      unlockDay: toNumber(resourceForm.unlockDay, 1),
      isPublished: Boolean(resourceForm.isPublished),
      createdAt: new Date(),
    };

    try {
      const createdResource = await addDoc(
        collection(db, "lmsResources"),
        payload,
      );

      setResources((previousResources) =>
        sortResources([
          ...previousResources,
          {
            id: createdResource.id,
            ...payload,
          },
        ]),
      );

      setResourceForm(emptyResource);
      showToast("Resource added.");
    } catch (error) {
      console.error("Resource add error:", error);
      showToast("Resource could not be added.");
    }
  };

  const removeResource = async (resource) => {
    const resourceName = resource.title || resource.fileName || resource.id;

    if (!window.confirm(`Remove resource "${resourceName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "lmsResources", resource.id));

      setResources((previousResources) =>
        previousResources.filter((item) => item.id !== resource.id),
      );

      showToast("Resource removed.");
    } catch (error) {
      console.error("Resource deletion error:", error);
      showToast("Resource could not be removed.");
    }
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
          <a href="/admin/live-sessions" className="admin-home-btn">
            Live Sessions
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
            <h2>Self-Paced Unlock Schedule</h2>
            <p className="admin-helper-text">
              Choose the date that counts as Day 1 for self-paced, pre-recorded
              lessons. A future date keeps every lesson locked until that date.
              After the date begins, one lesson day unlocks per calendar day.
            </p>

            <div className="admin-lms-form">
              <label>
                Start Date
                <input
                  type="date"
                  value={settings.selfPacedStartDate}
                  onChange={(event) =>
                    setSettings((previousSettings) => ({
                      ...previousSettings,
                      selfPacedStartDate: event.target.value,
                    }))
                  }
                />
              </label>

              <button
                type="button"
                className="admin-view-btn"
                onClick={saveSettings}
                disabled={savingId === "lms-settings"}
              >
                {savingId === "lms-settings" ? "Saving..." : "Save Start Date"}
              </button>
            </div>
          </section>

          <section className="admin-table-card admin-lms-card">
            <h2>Curriculum Lessons</h2>
            <p className="admin-helper-text">
              Order is locked: global order, course, section, and unlock day are
              visible but cannot be changed here.
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
                  Lesson Title
                  <input
                    value={lesson.title || ""}
                    onChange={(event) =>
                      updateLessonField(lesson.id, "title", event.target.value)
                    }
                  />
                </label>

                <label>
                  YouTube Link
                  <input
                    value={lesson.youtubeUrl || ""}
                    onChange={(event) =>
                      updateLessonField(
                        lesson.id,
                        "youtubeUrl",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={lesson.isPublished !== false}
                    onChange={(event) =>
                      updateLessonField(
                        lesson.id,
                        "isPublished",
                        event.target.checked,
                      )
                    }
                  />
                  Published
                </label>

                <button
                  type="button"
                  className="admin-view-btn"
                  onClick={() => saveLesson(lesson)}
                  disabled={savingId === lesson.id}
                >
                  {savingId === lesson.id ? "Saving..." : "Save Lesson"}
                </button>
              </article>
            ))}

            {lessons.length === 0 && (
              <p className="admin-empty">No curriculum lessons found.</p>
            )}
          </section>

          <section className="admin-table-card admin-lms-card">
            <h2>Add Resource</h2>

            <form className="admin-lms-form" onSubmit={addResource}>
              <input
                placeholder="Resource title"
                value={resourceForm.title}
                onChange={(event) =>
                  setResourceForm((previousForm) => ({
                    ...previousForm,
                    title: event.target.value,
                  }))
                }
                required
              />

              <select
                value={resourceForm.course}
                onChange={(event) =>
                  setResourceForm((previousForm) => ({
                    ...previousForm,
                    course: event.target.value,
                  }))
                }
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>

              <input
                placeholder="Section"
                value={resourceForm.section}
                onChange={(event) =>
                  setResourceForm((previousForm) => ({
                    ...previousForm,
                    section: event.target.value,
                  }))
                }
              />

              <input
                type="number"
                min="1"
                placeholder="Unlock day"
                value={resourceForm.unlockDay}
                onChange={(event) =>
                  setResourceForm((previousForm) => ({
                    ...previousForm,
                    unlockDay: event.target.value,
                  }))
                }
              />

              <input
                placeholder="File type"
                value={resourceForm.fileType}
                onChange={(event) =>
                  setResourceForm((previousForm) => ({
                    ...previousForm,
                    fileType: event.target.value,
                  }))
                }
              />

              <input
                placeholder="Download URL"
                value={resourceForm.downloadUrl}
                onChange={(event) =>
                  setResourceForm((previousForm) => ({
                    ...previousForm,
                    downloadUrl: event.target.value,
                  }))
                }
              />

              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={resourceForm.isPublished}
                  onChange={(event) =>
                    setResourceForm((previousForm) => ({
                      ...previousForm,
                      isPublished: event.target.checked,
                    }))
                  }
                />
                Published
              </label>

              <button type="submit" className="admin-approve">
                Add Resource
              </button>
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
                  Resource Title
                  <input
                    value={resource.title || resource.fileName || ""}
                    onChange={(event) =>
                      updateResourceField(
                        resource.id,
                        "title",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  File Type
                  <input
                    value={resource.fileType || ""}
                    onChange={(event) =>
                      updateResourceField(
                        resource.id,
                        "fileType",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  Download URL
                  <input
                    value={resource.downloadUrl || ""}
                    onChange={(event) =>
                      updateResourceField(
                        resource.id,
                        "downloadUrl",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={resource.isPublished !== false}
                    onChange={(event) =>
                      updateResourceField(
                        resource.id,
                        "isPublished",
                        event.target.checked,
                      )
                    }
                  />
                  Published
                </label>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="admin-view-btn"
                    onClick={() => saveResource(resource)}
                    disabled={savingId === resource.id}
                  >
                    {savingId === resource.id ? "Saving..." : "Save"}
                  </button>

                  <button
                    type="button"
                    className="admin-delete"
                    onClick={() => removeResource(resource)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}

            {resources.length === 0 && (
              <p className="admin-empty">No resources found.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
};

export default AdminLms;
