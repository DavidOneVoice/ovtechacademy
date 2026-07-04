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
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../src/firebase";
import "./Admin.css";

const allowedResourceExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "csv"];
const allowedResourceMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/comma-separated-values",
];
const resourceFileAccept = allowedResourceExtensions
  .map((extension) => `.${extension}`)
  .join(",");

const getFileExtension = (fileName = "") =>
  fileName.split(".").pop()?.toLowerCase() || "";

const isAllowedResourceFile = (file) => {
  if (!file) return false;
  return (
    allowedResourceExtensions.includes(getFileExtension(file.name)) ||
    allowedResourceMimeTypes.includes(file.type)
  );
};

const getSafeFileName = (fileName = "resource") => {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || `resource-${Date.now()}`;
};

const emptyResource = {
  title: "",
  course: "",
  section: "",
  unlockDay: 1,
  fileType: "PDF",
  downloadUrl: "",
  storagePath: "",
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
  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [uploadProgress, setUploadProgress] = useState({});
  const [resourceFiles, setResourceFiles] = useState({});
  const [newResourceFile, setNewResourceFile] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const loadLmsContent = async () => {
    setLoading(true);
    const [lessonSnapshot, resourceSnapshot] = await Promise.all([
      getDocs(
        query(collection(db, "curriculum"), orderBy("globalOrder", "asc")),
      ),
      getDocs(
        query(collection(db, "lmsResources"), orderBy("unlockDay", "asc")),
      ),
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
        ...new Set(lessons.map((lesson) => lesson.course).filter(Boolean)),
      ].sort(),
    [lessons],
  );

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
      storagePath: resource.storagePath || "",
      fileName: resource.fileName || "",
      isPublished: resource.isPublished !== false,
    });
    setSavingId("");
    showToast("Resource saved.");
  };

  const addResource = async (event) => {
    event.preventDefault();
    if (newResourceFile && !isAllowedResourceFile(newResourceFile)) {
      showToast("Only PDF, Word, Excel, or CSV resources can be uploaded.");
      return;
    }

    const payload = {
      ...resourceForm,
      unlockDay: toNumber(resourceForm.unlockDay, 1),
      isPublished: Boolean(resourceForm.isPublished),
      createdAt: new Date(),
    };
    const created = await addDoc(collection(db, "lmsResources"), payload);
    const createdResource = { id: created.id, ...payload };
    setResources((prev) => sortResources([...prev, createdResource]));

    if (newResourceFile) {
      try {
        await uploadResourceFile(created.id, newResourceFile);
      } catch (error) {
        console.error("New resource upload error:", error);
      }
    } else {
      showToast("Resource added.");
    }

    setNewResourceFile(null);
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

  const uploadResourceFile = (resourceId, file) => {
    if (!file) {
      showToast("Choose a PDF, Word, Excel, or CSV file first.");
      return Promise.resolve(null);
    }

    if (!isAllowedResourceFile(file)) {
      showToast("Only PDF, Word, Excel, or CSV resources can be uploaded.");
      return Promise.resolve(null);
    }

    const safeFileName = getSafeFileName(file.name);
    const storagePath = `lms-resources/${resourceId}/${safeFileName}`;
    const resourceRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(resourceRef, file, {
      contentType: file.type || undefined,
    });

    setUploadingId(resourceId);
    setUploadProgress((prev) => ({ ...prev, [resourceId]: 0 }));

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
          setUploadProgress((prev) => ({ ...prev, [resourceId]: progress }));
        },
        (error) => {
          setUploadingId("");
          showToast("Resource upload failed. Please try again.");
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then(async (downloadUrl) => {
              const fileType = getFileExtension(file.name).toUpperCase();
              const fileData = {
                downloadUrl,
                storagePath,
                fileName: file.name,
                fileType,
              };

              await updateDoc(doc(db, "lmsResources", resourceId), fileData);
              setResources((prev) =>
                sortResources(
                  prev.map((resource) =>
                    resource.id === resourceId
                      ? { ...resource, ...fileData }
                      : resource,
                  ),
                ),
              );
              setResourceFiles((prev) => {
                const next = { ...prev };
                delete next[resourceId];
                return next;
              });
              setUploadingId("");
              showToast("Resource uploaded successfully.");
              resolve(fileData);
            })
            .catch((error) => {
              setUploadingId("");
              showToast("Resource upload failed. Please try again.");
              reject(error);
            });
        },
      );
    });
  };

  const uploadExistingResource = async (resource) => {
    try {
      await uploadResourceFile(resource.id, resourceFiles[resource.id]);
    } catch (error) {
      console.error("Resource upload error:", error);
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
              <input
                placeholder="Firebase Storage path"
                value={resourceForm.storagePath}
                onChange={(e) =>
                  setResourceForm((prev) => ({
                    ...prev,
                    storagePath: e.target.value,
                  }))
                }
              />
              <label>
                Upload file
                <input
                  type="file"
                  accept={resourceFileAccept}
                  onChange={(e) =>
                    setNewResourceFile(e.target.files?.[0] || null)
                  }
                />
              </label>
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
                <label>
                  Storage path
                  <input
                    value={resource.storagePath || ""}
                    onChange={(e) =>
                      updateResourceField(
                        resource.id,
                        "storagePath",
                        e.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Upload file
                  <input
                    type="file"
                    accept={resourceFileAccept}
                    onChange={(e) =>
                      setResourceFiles((prev) => ({
                        ...prev,
                        [resource.id]: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </label>
                {uploadingId === resource.id && (
                  <p className="admin-upload-status">
                    Uploading... {uploadProgress[resource.id] || 0}%
                  </p>
                )}
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
                    disabled={
                      savingId === resource.id || uploadingId === resource.id
                    }
                  >
                    {savingId === resource.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="admin-approve"
                    onClick={() => uploadExistingResource(resource)}
                    disabled={uploadingId === resource.id}
                  >
                    {uploadingId === resource.id
                      ? "Uploading..."
                      : "Upload File"}
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
    </main>
  );
};

export default AdminLms;
