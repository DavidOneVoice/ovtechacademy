import { collection, orderBy, query, where } from "firebase/firestore";

import { curriculumItemMatchesGroup } from "./tracks";

export const LMS_RESOURCE_COLLECTION = "lmsResources";
export const LMS_CURRICULUM_COLLECTION = "curriculum";

export const getAdminResourceQuery = (db) =>
  query(collection(db, LMS_RESOURCE_COLLECTION), orderBy("unlockDay", "asc"));

export const getStudentResourceQuery = (db) =>
  query(
    collection(db, LMS_RESOURCE_COLLECTION),
    where("isPublished", "==", true),
  );

export const snapshotItems = (snapshot, sourceCollection) =>
  snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    sourceCollection,
  }));

export const filterItemsForCurriculumGroup = (items, curriculumGroup) =>
  curriculumGroup
    ? items.filter((item) =>
        curriculumItemMatchesGroup(item, curriculumGroup),
      )
    : [];

export const isCurriculumLesson = (item) =>
  String(item?.type || "").trim().toLowerCase() !== "resource";

export const getResourceDebugRows = (resources) =>
  resources.map((resource) => ({
    id: resource.id,
    title: resource.title || resource.fileName || "",
    sourceCollection: resource.sourceCollection || LMS_RESOURCE_COLLECTION,
    curriculumGroup: resource.curriculumGroup || "(legacy: data-analytics)",
    course: resource.course || "",
    section: resource.section || "",
    unlockDay: resource.unlockDay ?? 1,
    downloadUrl: resource.downloadUrl || "",
    storagePath: resource.storagePath || "",
  }));

