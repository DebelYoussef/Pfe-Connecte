import { activities, reports, requests, students, teacher } from '../data/teacherMockData'

const clone = (value) => JSON.parse(JSON.stringify(value))

export async function getTeacherDashboard() {
  return { teacher: clone(teacher), stats: { students: 24, requests: 3, reportsToReview: 5, validatedReports: 16 }, activities: clone(activities) }
}
export async function getSupervisedStudents() { return clone(students) }
export async function getSupervisionRequests() { return clone(requests) }
export async function acceptSupervisionRequest(id) { return requests.find((item) => item.id === id) }
export async function declineSupervisionRequest(id) { return requests.find((item) => item.id === id) }
export async function getReports() { return clone(reports) }
export async function validateReport(id) { return reports.find((item) => item.id === id) }
export async function requestReportChanges(id) { return reports.find((item) => item.id === id) }
