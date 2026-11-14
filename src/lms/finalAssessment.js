import { curriculumItemMatchesStudentTrack } from './tracks.js';

export const FINAL_ASSESSMENT = {
  course: 'Virtual Assistant',
  courseId: 'virtual-assistance',
  path: '/lms/final-assessment',
  total: 100,
  minutes: 60,
};

export const FINAL_ASSESSMENT_ADMIN_PATH = '/admin/final-assessments';
export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function isFinalAssessmentStudent(student) {
  return student?.courseId === FINAL_ASSESSMENT.courseId ||
    curriculumItemMatchesStudentTrack({ course: FINAL_ASSESSMENT.course }, student);
}

export const assessmentStatusLabels = {
  in_progress: 'In progress',
  submitted: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Retake allowed',
};
