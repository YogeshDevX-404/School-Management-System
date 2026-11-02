// ============================================================
// AI TOOL LAYER — Secure backend tools for LLM function calling
// Every tool enforces RBAC before querying the database.
// The LLM NEVER touches the database directly.
// ============================================================

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";

export interface ToolContext {
  supabase: SupabaseClient;
  role: string;
  userId: string;
  teacherClassIds?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; enum?: string[] }>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================
// PERMISSION HELPERS
// ============================================================

function canAccessFees(role: string): boolean {
  return ["admin", "super_admin", "principal", "accountant"].includes(role);
}

function canAccessAcademics(role: string): boolean {
  return ["admin", "super_admin", "principal", "teacher"].includes(role);
}

function canAccessStaff(role: string): boolean {
  return ["admin", "super_admin", "principal"].includes(role);
}

// ============================================================
// TOOL DEFINITIONS (exposed to LLM)
// ============================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "getSchoolSummary",
    description: "Get a high-level overview of the school: total students, teachers, staff, today's attendance, and fee collection (if permitted).",
    parameters: {},
  },
  {
    name: "getStudents",
    description: "Get a list of students. Optionally filter by class number and/or section. Returns name, admission number, class, and status.",
    parameters: {
      classNumeric: { type: "number", description: "Class number (e.g., 10 for Class 10)" },
      section: { type: "string", description: "Section letter (e.g., 'A', 'B')" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
  },
  {
    name: "getStudentByName",
    description: "Find a student by name (partial match). Returns student details including class and admission number.",
    parameters: {
      name: { type: "string", description: "Student name or partial name to search" },
    },
  },
  {
    name: "getTeachers",
    description: "Get a list of all teachers with their department and email.",
    parameters: {},
  },
  {
    name: "getTeacherByName",
    description: "Find a teacher by name (partial match). Returns teacher details including department.",
    parameters: {
      name: { type: "string", description: "Teacher name or partial name to search" },
    },
  },
  {
    name: "getAttendance",
    description: "Get attendance summary for a specific date (defaults to today). Returns present, absent, total counts and rate.",
    parameters: {
      date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" },
    },
  },
  {
    name: "getAttendanceByClass",
    description: "Get attendance for a specific class on a specific date (defaults to today). Returns present/absent counts and rate.",
    parameters: {
      classNumeric: { type: "number", description: "Class number (e.g., 10)" },
      section: { type: "string", description: "Section letter (e.g., 'A')" },
      date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" },
    },
  },
  {
    name: "getAttendanceByStudent",
    description: "Get attendance history for a specific student. Returns recent attendance records with status and date.",
    parameters: {
      studentId: { type: "string", description: "Student UUID" },
      studentName: { type: "string", description: "Student name (used to look up ID if studentId not provided)" },
    },
  },
  {
    name: "getAbsentStudents",
    description: "Get list of students absent on a specific date (defaults to today). Returns names, admission numbers, and classes.",
    parameters: {
      date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" },
    },
  },
  {
    name: "getLowAttendanceStudents",
    description: "Get students whose attendance rate is below a threshold. Useful for identifying at-risk students.",
    parameters: {
      threshold: { type: "number", description: "Attendance percentage threshold (e.g., 75 for below 75%)" },
      classNumeric: { type: "number", description: "Optional: filter by class number" },
    },
  },
  {
    name: "getLowestAttendanceClasses",
    description: "Get classes ranked by lowest attendance for today. Returns class name, total students, present count, and rate.",
    parameters: {
      limit: { type: "number", description: "Number of classes to return (default 5)" },
    },
  },
  {
    name: "getPendingFees",
    description: "Get summary of pending fees: count and total pending amount. Requires fee access permission.",
    parameters: {},
  },
  {
    name: "getPendingFeeStudents",
    description: "Get list of students with pending fees, including amount and due date. Requires fee access permission.",
    parameters: {
      minAmount: { type: "number", description: "Minimum pending amount to filter (e.g., 5000)" },
    },
  },
  {
    name: "getFeeSummary",
    description: "Get fee summary: collected amount, pending amount, total, and counts. Requires fee access permission.",
    parameters: {},
  },
  {
    name: "getFeeByStudent",
    description: "Get fee/payment records for a specific student. Requires fee access permission.",
    parameters: {
      studentName: { type: "string", description: "Student name to look up" },
    },
  },
  {
    name: "getTimetable",
    description: "Get timetable for a specific day (defaults to today). Returns period, time, subject, teacher, and class.",
    parameters: {
      day: { type: "string", description: "Day of week (e.g., 'monday'). Defaults to today.", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
    },
  },
  {
    name: "getNotices",
    description: "Get latest published notices. Returns title, description, priority, author, and date.",
    parameters: {
      limit: { type: "number", description: "Number of notices (default 5)" },
    },
  },
  {
    name: "getLeaveRequests",
    description: "Get recent leave requests. Returns teacher name, dates, status, and reason.",
    parameters: {
      limit: { type: "number", description: "Number of records (default 10)" },
    },
  },
  {
    name: "getAdmissions",
    description: "Get recent admissions. Returns student name, admission number, and admission date.",
    parameters: {
      date: { type: "string", description: "Specific date in YYYY-MM-DD (defaults to today)" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  {
    name: "getClasses",
    description: "Get list of all classes in the school.",
    parameters: {},
  },
  {
    name: "getSubjects",
    description: "Get list of all subjects offered by the school.",
    parameters: {},
  },
  {
    name: "getTeacherAssignments",
    description: "Get teacher-subject-class assignments. Optionally filter by subject name.",
    parameters: {
      subjectName: { type: "string", description: "Subject name to filter (e.g., 'Mathematics')" },
    },
  },
  {
    name: "getUpcomingBirthdays",
    description: "Get students or staff with upcoming birthdays in the next N days.",
    parameters: {
      days: { type: "number", description: "Number of days to look ahead (default 7)" },
    },
  },
  {
    name: "getAttendanceTrend",
    description: "Get attendance trend over the last N days. Returns daily present/absent counts and rate. Useful for analytics.",
    parameters: {
      days: { type: "number", description: "Number of days of history (default 7)" },
    },
  },
  {
    name: "getFeeCollectionTrend",
    description: "Get fee collection trend over recent months. Returns monthly collected and pending amounts. Requires fee access.",
    parameters: {
      months: { type: "number", description: "Number of months of history (default 3)" },
    },
  },
  {
    name: "generateDocumentDraft",
    description: "Generate a structured document draft (notice, circular, agenda, summary). Does NOT publish — returns draft for user confirmation.",
    parameters: {
      type: { type: "string", description: "Type of document to generate", enum: ["notice", "circular", "meeting_agenda", "student_summary", "fee_summary", "attendance_summary", "event_summary", "teacher_summary"] },
      topic: { type: "string", description: "Topic or subject of the document" },
      context: { type: "string", description: "Additional context or data to include" },
    },
  },
];

// ============================================================
// TOOL IMPLEMENTATIONS
// ============================================================

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayName(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

async function findClassIds(supabase: SupabaseClient, classNumeric?: number, section?: string): Promise<string[]> {
  let q = supabase.from("classes").select("id").eq("is_deleted", false);
  if (classNumeric) q = q.eq("class_numeric", classNumeric);
  const { data } = await q;
  return (data || []).map((c: any) => c.id);
}

export async function executeTool(toolName: string, args: any, ctx: ToolContext): Promise<ToolResult> {
  const { supabase, role, userId } = ctx;

  try {
    switch (toolName) {
      // ---- SCHOOL SUMMARY ----
      case "getSchoolSummary": {
        const [students, staff, teachers, todayAtt] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("staff").select("*", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("staff").select("*", { count: "exact", head: true }).eq("is_deleted", false).eq("role", "teacher"),
          supabase.from("attendance").select("id, status").eq("is_deleted", false).eq("date", todayStr()),
        ]);
        const present = (todayAtt.data || []).filter((a: any) => a.status === "present").length;
        const total = (todayAtt.data || []).length;
        let feeData: any = null;
        if (canAccessFees(role)) {
          const { data: payments } = await supabase.from("payments").select("amount, status").eq("is_deleted", false).eq("status", "completed");
          feeData = { totalCollection: (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0) };
        }
        return { success: true, data: { students: students.count || 0, staff: staff.count || 0, teachers: teachers.count || 0, todayPresent: present, todayTotal: total, todayRate: total > 0 ? Math.round((present / total) * 100) : 0, fee: feeData } };
      }

      // ---- STUDENTS ----
      case "getStudents": {
        const limit = args.limit || 50;
        let q = supabase.from("students").select("id, first_name, last_name, admission_number, class_id, status").eq("is_deleted", false).limit(limit);
        if (args.classNumeric) {
          const classIds = await findClassIds(supabase, args.classNumeric, args.section);
          if (!classIds.length) return { success: false, error: `Class ${args.classNumeric}${args.section || ""} not found` };
          q = q.in("class_id", classIds);
        }
        const { data, error } = await q.order("first_name");
        if (error) return { success: false, error: error.message };
        return { success: true, data: { students: data || [], count: (data || []).length } };
      }

      case "getStudentByName": {
        if (!args.name) return { success: false, error: "Student name is required" };
        const { data, error } = await supabase.from("students").select("id, first_name, last_name, admission_number, class_id, status, date_of_birth, gender, guardian_name, contact_number").eq("is_deleted", false).or(`first_name.ilike.%${args.name}%,last_name.ilike.%${args.name}%`).limit(10);
        if (error) return { success: false, error: error.message };
        return { success: true, data: { students: data || [], count: (data || []).length } };
      }

      // ---- TEACHERS ----
      case "getTeachers": {
        if (!canAccessStaff(role) && !canAccessAcademics(role)) return { success: false, error: "You don't have permission to view staff details." };
        const { data, error } = await supabase.from("staff").select("id, first_name, last_name, department, email, phone").eq("is_deleted", false).eq("role", "teacher").order("first_name");
        if (error) return { success: false, error: error.message };
        return { success: true, data: { teachers: data || [], count: (data || []).length } };
      }

      case "getTeacherByName": {
        if (!args.name) return { success: false, error: "Teacher name is required" };
        const { data, error } = await supabase.from("staff").select("id, first_name, last_name, department, email, phone, role").eq("is_deleted", false).or(`first_name.ilike.%${args.name}%,last_name.ilike.%${args.name}%`).limit(5);
        if (error) return { success: false, error: error.message };
        return { success: true, data: { teachers: data || [], count: (data || []).length } };
      }

      // ---- ATTENDANCE ----
      case "getAttendance": {
        const date = args.date || todayStr();
        const { data, error } = await supabase.from("attendance").select("id, status, person_type").eq("is_deleted", false).eq("date", date);
        if (error) return { success: false, error: error.message };
        const records = data || [];
        const present = records.filter((a: any) => a.status === "present").length;
        const absent = records.filter((a: any) => a.status === "absent").length;
        return { success: true, data: { date, present, absent, total: records.length, rate: records.length > 0 ? Math.round((present / records.length) * 100) : 0 } };
      }

      case "getAttendanceByClass": {
        if (!args.classNumeric) return { success: false, error: "Class number is required" };
        const date = args.date || todayStr();
        const classIds = await findClassIds(supabase, args.classNumeric, args.section);
        if (!classIds.length) return { success: false, error: `Class ${args.classNumeric}${args.section || ""} not found` };
        const { data: students } = await supabase.from("students").select("id, first_name, last_name").eq("is_deleted", false).in("class_id", classIds);
        const studentIds = (students || []).map((s: any) => s.id);
        if (!studentIds.length) return { success: true, data: { present: 0, absent: 0, total: 0, rate: 0 } };
        const { data: att } = await supabase.from("attendance").select("person_id, status").eq("is_deleted", false).eq("date", date).eq("person_type", "student").in("person_id", studentIds);
        const present = (att || []).filter((a: any) => a.status === "present").length;
        const absent = (att || []).filter((a: any) => a.status === "absent").length;
        const presentStudents = (students || []).filter((s: any) => (att || []).some((a: any) => a.person_id === s.id && a.status === "present"));
        return { success: true, data: { date, classNumeric: args.classNumeric, section: args.section, present, absent, total: studentIds.length, rate: Math.round((present / studentIds.length) * 100), presentStudents } };
      }

      case "getAttendanceByStudent": {
        let studentId = args.studentId;
        if (!studentId && args.studentName) {
          const { data } = await supabase.from("students").select("id").eq("is_deleted", false).or(`first_name.ilike.%${args.studentName}%,last_name.ilike.%${args.studentName}%`).limit(1).maybeSingle();
          studentId = data?.id;
        }
        if (!studentId) return { success: false, error: "Student not found" };
        const { data, error } = await supabase.from("attendance").select("date, status").eq("is_deleted", false).eq("person_id", studentId).order("date", { ascending: false }).limit(30);
        if (error) return { success: false, error: error.message };
        const records = data || [];
        const present = records.filter((r: any) => r.status === "present").length;
        return { success: true, data: { records, total: records.length, present, rate: records.length > 0 ? Math.round((present / records.length) * 100) : 0 } };
      }

      case "getAbsentStudents": {
        const date = args.date || todayStr();
        const { data: att } = await supabase.from("attendance").select("person_id").eq("is_deleted", false).eq("date", date).eq("status", "absent").eq("person_type", "student");
        const studentIds = (att || []).map((a: any) => a.person_id);
        if (!studentIds.length) return { success: true, data: { count: 0, students: [] } };
        const { data: students } = await supabase.from("students").select("id, first_name, last_name, admission_number, class_id").in("id", studentIds);
        return { success: true, data: { count: studentIds.length, students: students || [] } };
      }

      case "getLowAttendanceStudents": {
        const threshold = args.threshold || 75;
        const days = 30;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        const since = sinceDate.toISOString().slice(0, 10);
        let studentFilter = supabase.from("students").select("id, first_name, last_name, admission_number, class_id").eq("is_deleted", false);
        if (args.classNumeric) {
          const classIds = await findClassIds(supabase, args.classNumeric);
          studentFilter = studentFilter.in("class_id", classIds);
        }
        const { data: students } = await studentFilter;
        const { data: att } = await supabase.from("attendance").select("person_id, status, date").eq("is_deleted", false).eq("person_type", "student").gte("date", since);
        const lowAtt: any[] = [];
        for (const s of students || []) {
          const records = (att || []).filter((a: any) => a.person_id === s.id);
          if (!records.length) continue;
          const present = records.filter((r: any) => r.status === "present").length;
          const rate = Math.round((present / records.length) * 100);
          if (rate < threshold) lowAtt.push({ ...s, attendanceRate: rate, totalDays: records.length, presentDays: present });
        }
        lowAtt.sort((a, b) => a.attendanceRate - b.attendanceRate);
        return { success: true, data: { threshold, count: lowAtt.length, students: lowAtt } };
      }

      case "getLowestAttendanceClasses": {
        const limit = args.limit || 5;
        const { data: classes } = await supabase.from("classes").select("id, class_numeric, class_name").eq("is_deleted", false);
        const { data: students } = await supabase.from("students").select("id, class_id").eq("is_deleted", false);
        const { data: att } = await supabase.from("attendance").select("person_id, status").eq("is_deleted", false).eq("date", todayStr()).eq("person_type", "student");
        const results: any[] = [];
        for (const c of classes || []) {
          const classStudents = (students || []).filter((s: any) => s.class_id === c.id);
          const classAtt = (att || []).filter((a: any) => classStudents.some((s: any) => s.id === a.person_id));
          const present = classAtt.filter((a: any) => a.status === "present").length;
          const rate = classStudents.length > 0 ? Math.round((present / classStudents.length) * 100) : 0;
          results.push({ className: c.class_name || `Class ${c.class_numeric}`, total: classStudents.length, present, rate });
        }
        results.sort((a, b) => a.rate - b.rate);
        return { success: true, data: { classes: results.slice(0, limit) } };
      }

      // ---- FEES ----
      case "getPendingFees": {
        if (!canAccessFees(role)) return { success: false, error: "You don't have permission to access fee information." };
        const { data, error } = await supabase.from("payments").select("amount, status").eq("is_deleted", false).neq("status", "completed");
        if (error) return { success: false, error: error.message };
        const pending = data || [];
        return { success: true, data: { count: pending.length, totalPending: pending.reduce((s: number, p: any) => s + Number(p.amount), 0) } };
      }

      case "getPendingFeeStudents": {
        if (!canAccessFees(role)) return { success: false, error: "You don't have permission to access fee information." };
        const { data: payments, error } = await supabase.from("payments").select("id, amount, status, due_date, student_id").eq("is_deleted", false).neq("status", "completed");
        if (error) return { success: false, error: error.message };
        let pending = payments || [];
        if (args.minAmount) pending = pending.filter((p: any) => Number(p.amount) >= args.minAmount);
        const studentIds = pending.map((p: any) => p.student_id).filter(Boolean);
        let students: any[] = [];
        if (studentIds.length) {
          const { data: studentData } = await supabase.from("students").select("id, first_name, last_name, admission_number, class_id").in("id", studentIds);
          students = studentData || [];
        }
        const result = pending.map((p: any) => {
          const student = students.find((s: any) => s.id === p.student_id);
          return { name: student ? `${student.first_name} ${student.last_name}` : "Unknown", admissionNo: student?.admission_number || "N/A", amount: Number(p.amount), dueDate: p.due_date };
        });
        return { success: true, data: { students: result, count: result.length, totalPending: result.reduce((s: number, r: any) => s + r.amount, 0) } };
      }

      case "getFeeSummary": {
        if (!canAccessFees(role)) return { success: false, error: "You don't have permission to access fee information." };
        const { data, error } = await supabase.from("payments").select("amount, status, created_at").eq("is_deleted", false);
        if (error) return { success: false, error: error.message };
        const all = data || [];
        const collected = all.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0);
        const pending = all.filter((p: any) => p.status !== "completed").reduce((s: number, p: any) => s + Number(p.amount), 0);
        return { success: true, data: { collected, pending, total: collected + pending, collectedCount: all.filter((p: any) => p.status === "completed").length, pendingCount: all.filter((p: any) => p.status !== "completed").length } };
      }

      case "getFeeByStudent": {
        if (!canAccessFees(role)) return { success: false, error: "You don't have permission to access fee information." };
        if (!args.studentName) return { success: false, error: "Student name is required" };
        const { data: student } = await supabase.from("students").select("id, first_name, last_name, admission_number").eq("is_deleted", false).or(`first_name.ilike.%${args.studentName}%,last_name.ilike.%${args.studentName}%`).limit(1).maybeSingle();
        if (!student) return { success: false, error: "Student not found" };
        const { data: payments } = await supabase.from("payments").select("id, amount, status, due_date, payment_date, payment_method").eq("is_deleted", false).eq("student_id", student.id);
        return { success: true, data: { student, payments: payments || [] } };
      }

      // ---- TIMETABLE ----
      case "getTimetable": {
        const day = args.day || dayName(0);
        const { data, error } = await supabase.from("timetable").select("id, day_of_week, period_number, start_time, end_time, subject_id, teacher_id, class_id").eq("is_deleted", false).eq("day_of_week", day).order("period_number");
        if (error) return { success: false, error: error.message };
        let enriched = data || [];
        if (enriched.length) {
          const teacherIds = [...new Set(enriched.map((t: any) => t.teacher_id).filter(Boolean))];
          const subjectIds = [...new Set(enriched.map((t: any) => t.subject_id).filter(Boolean))];
          const classIds = [...new Set(enriched.map((t: any) => t.class_id).filter(Boolean))];
          const [teachers, subjects, classes] = await Promise.all([
            teacherIds.length ? supabase.from("staff").select("id, first_name, last_name").in("id", teacherIds) : Promise.resolve({ data: [] }),
            subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] }),
            classIds.length ? supabase.from("classes").select("id, class_name").in("id", classIds) : Promise.resolve({ data: [] }),
          ]);
          enriched = enriched.map((t: any) => ({
            ...t,
            teacher: (teachers.data || []).find((s: any) => s.id === t.teacher_id),
            subject: (subjects.data || []).find((s: any) => s.id === t.subject_id),
            class: (classes.data || []).find((s: any) => s.id === t.class_id),
          }));
        }
        return { success: true, data: { timetable: enriched, day } };
      }

      // ---- NOTICES ----
      case "getNotices": {
        const limit = args.limit || 5;
        const { data, error } = await supabase.from("notices").select("id, title, description, priority, author_name, author_role, publish_date, expiry_date").eq("is_deleted", false).eq("is_published", true).order("publish_date", { ascending: false }).limit(limit);
        if (error) return { success: false, error: error.message };
        return { success: true, data: { notices: data || [] } };
      }

      // ---- LEAVE ----
      case "getLeaveRequests": {
        const limit = args.limit || 10;
        const { data, error } = await supabase.from("leave_requests").select("id, user_id, start_date, end_date, reason, status, created_at").eq("is_deleted", false).order("created_at", { ascending: false }).limit(limit);
        if (error) return { success: false, error: error.message };
        let enriched = data || [];
        if (enriched.length) {
          const userIds = [...new Set(enriched.map((l: any) => l.user_id).filter(Boolean))];
          const { data: profiles } = await supabase.from("profiles").select("id, full_name, role").in("id", userIds);
          enriched = enriched.map((l: any) => ({ ...l, user: (profiles || []).find((p: any) => p.id === l.user_id) }));
        }
        return { success: true, data: { leaveRequests: enriched } };
      }

      // ---- ADMISSIONS ----
      case "getAdmissions": {
        const date = args.date || todayStr();
        const limit = args.limit || 10;
        const { data, error } = await supabase.from("students").select("id, first_name, last_name, admission_number, admission_date").eq("is_deleted", false).eq("admission_date", date).limit(limit);
        if (error) return { success: false, error: error.message };
        return { success: true, data: { date, count: (data || []).length, students: data || [] } };
      }

      // ---- CLASSES / SUBJECTS ----
      case "getClasses": {
        const { data, error } = await supabase.from("classes").select("id, class_numeric, class_name").eq("is_deleted", false).order("class_numeric");
        if (error) return { success: false, error: error.message };
        return { success: true, data: { classes: data || [] } };
      }

      case "getSubjects": {
        const { data, error } = await supabase.from("subjects").select("id, name, code").eq("is_deleted", false).order("name");
        if (error) return { success: false, error: error.message };
        return { success: true, data: { subjects: data || [] } };
      }

      case "getTeacherAssignments": {
        let q = supabase.from("teacher_class_assignments").select("id, teacher_id, subject_id, class_id, is_active").eq("is_deleted", false).eq("is_active", true);
        const { data: assignments } = await q;
        let enriched = assignments || [];
        if (args.subjectName) {
          const { data: subjects } = await supabase.from("subjects").select("id, name").ilike("name", `%${args.subjectName}%`);
          const subjectIds = (subjects || []).map((s: any) => s.id);
          enriched = enriched.filter((a: any) => subjectIds.includes(a.subject_id));
        }
        if (enriched.length) {
          const teacherIds = [...new Set(enriched.map((a: any) => a.teacher_id).filter(Boolean))];
          const subjectIds = [...new Set(enriched.map((a: any) => a.subject_id).filter(Boolean))];
          const classIds = [...new Set(enriched.map((a: any) => a.class_id).filter(Boolean))];
          const [teachers, subjects, classes] = await Promise.all([
            teacherIds.length ? supabase.from("staff").select("id, first_name, last_name, department").in("id", teacherIds) : Promise.resolve({ data: [] }),
            subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] }),
            classIds.length ? supabase.from("classes").select("id, class_name").in("id", classIds) : Promise.resolve({ data: [] }),
          ]);
          enriched = enriched.map((a: any) => ({
            teacher: (teachers.data || []).find((t: any) => t.id === a.teacher_id),
            subject: (subjects.data || []).find((s: any) => s.id === a.subject_id),
            class: (classes.data || []).find((c: any) => c.id === a.class_id),
          }));
        }
        return { success: true, data: { assignments: enriched } };
      }

      // ---- BIRTHDAYS ----
      case "getUpcomingBirthdays": {
        const days = args.days || 7;
        const today = new Date();
        const students = await supabase.from("students").select("id, first_name, last_name, date_of_birth").eq("is_deleted", false);
        const staff = await supabase.from("staff").select("id, first_name, last_name, date_of_birth").eq("is_deleted", false);
        const all = [...(students.data || []), ...(staff.data || [])];
        const upcoming: any[] = [];
        for (const p of all) {
          if (!p.date_of_birth) continue;
          const dob = new Date(p.date_of_birth);
          const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          if (thisYear < today) thisYear.setFullYear(thisYear.getFullYear() + 1);
          const diff = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff <= days && diff >= 0) {
            upcoming.push({ name: `${p.first_name} ${p.last_name}`, birthday: thisYear.toLocaleDateString("en-IN"), age: today.getFullYear() - dob.getFullYear(), daysUntil: diff });
          }
        }
        upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
        return { success: true, data: { birthdays: upcoming, count: upcoming.length } };
      }

      // ---- ANALYTICS: ATTENDANCE TREND ----
      case "getAttendanceTrend": {
        const days = args.days || 7;
        const since = new Date();
        since.setDate(since.getDate() - days);
        const { data, error } = await supabase.from("attendance").select("date, status").eq("is_deleted", false).gte("date", since.toISOString().slice(0, 10)).order("date");
        if (error) return { success: false, error: error.message };
        const byDate: Record<string, { present: number; absent: number; total: number }> = {};
        for (const r of data || []) {
          if (!byDate[r.date]) byDate[r.date] = { present: 0, absent: 0, total: 0 };
          byDate[r.date].total++;
          if (r.status === "present") byDate[r.date].present++;
          else if (r.status === "absent") byDate[r.date].absent++;
        }
        const trend = Object.entries(byDate).map(([date, v]) => ({ date, ...v, rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0 })).sort((a, b) => a.date.localeCompare(b.date));
        return { success: true, data: { trend, days } };
      }

      // ---- ANALYTICS: FEE COLLECTION TREND ----
      case "getFeeCollectionTrend": {
        if (!canAccessFees(role)) return { success: false, error: "You don't have permission to access fee information." };
        const months = args.months || 3;
        const { data, error } = await supabase.from("payments").select("amount, status, created_at").eq("is_deleted", false);
        if (error) return { success: false, error: error.message };
        const now = new Date();
        const trend: any[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();
          const monthData = (data || []).filter((p: any) => p.created_at >= monthStart && p.created_at <= monthEnd);
          const collected = monthData.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0);
          const pending = monthData.filter((p: any) => p.status !== "completed").reduce((s: number, p: any) => s + Number(p.amount), 0);
          trend.push({ month: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), collected, pending, total: collected + pending });
        }
        return { success: true, data: { trend, months } };
      }

      // ---- DOCUMENT GENERATION ----
      case "generateDocumentDraft": {
        const { type, topic, context } = args;
        const draft = buildDocumentDraft(type, topic || "", context || "");
        return { success: true, data: { draft, type, topic } };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { success: false, error: err.message || "Tool execution failed" };
  }
}

// ============================================================
// DOCUMENT DRAFT GENERATOR
// ============================================================

function buildDocumentDraft(type: string, topic: string, context: string): string {
  const date = new Date().toLocaleDateString("en-IN");
  switch (type) {
    case "notice":
      return `**NOTICE**\n\nDate: ${date}\n\nSubject: ${topic || "General Notice"}\n\n${context || "This is to inform all concerned that the above-mentioned matter requires attention. Kindly take note and act accordingly."}\n\nFor any queries, please contact the school office.\n\n**Principal**\n[School Name]`;
    case "circular":
      return `**CIRCULAR**\n\nRef No: ___/${new Date().getFullYear()}\nDate: ${date}\n\nTo: All Staff Members\n\nSubject: ${topic || "General Circular"}\n\n${context || "All staff members are hereby informed about the following matter. Please ensure compliance and disseminate this information to relevant parties."}\n\n**Principal**\n[School Name]`;
    case "meeting_agenda":
      return `**MEETING AGENDA**\n\nDate: ${date}\nTime: [To be decided]\nVenue: [School Conference Room]\n\n**Agenda:**\n1. Opening remarks\n2. ${topic || "Discussion on school matters"}\n3. ${context || "Review of current status and action items"}\n4. Open discussion\n5. Action items and next steps\n6. Closing\n\n**Chairperson:** Principal`;
    case "student_summary":
      return `**STUDENT SUMMARY REPORT**\n\nDate: ${date}\n\n${context || "Summary of student academic and attendance performance."}\n\nThis report provides an overview of student metrics including attendance rates, academic performance, and areas requiring attention.`;
    case "fee_summary":
      return `**FEE SUMMARY REPORT**\n\nDate: ${date}\n\n${context || "Overview of fee collection and pending dues."}\n\nThis report details the fee collection status, pending amounts, and recommendations for follow-up.`;
    case "attendance_summary":
      return `**ATTENDANCE SUMMARY REPORT**\n\nDate: ${date}\n\n${context || "Overview of attendance across classes."}\n\nThis report highlights attendance trends, classes with low attendance, and students requiring intervention.`;
    case "event_summary":
      return `**EVENT SUMMARY**\n\nEvent: ${topic || "School Event"}\nDate: ${date}\n\n${context || "Summary of the event including participation, outcomes, and feedback."}\n\nThe event was conducted successfully with active participation from students and staff.`;
    case "teacher_summary":
      return `**TEACHER SUMMARY REPORT**\n\nDate: ${date}\n\n${context || "Overview of teacher assignments and workload."}\n\nThis report provides details on teacher assignments, subjects taught, and class distribution.`;
    default:
      return `**DRAFT DOCUMENT**\n\nDate: ${date}\n\nTopic: ${topic}\n\n${context}`;
  }
}
