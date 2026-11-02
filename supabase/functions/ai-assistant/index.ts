import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { runLLMWithTools, type ToolContext } from "./llm.ts";
import { executeTool, type ToolContext as TC } from "./tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  userId: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

// ============================================================
// NATURAL LANGUAGE INTENT DETECTION
// Understands English, Hindi, Hinglish, typos, mixed language
// ============================================================
type Intent =
  | 'school_summary' | 'total_students' | 'total_teachers' | 'pending_fees'
  | 'today_attendance' | 'absent_today' | 'class_attendance' | 'lowest_attendance'
  | 'latest_notices' | 'timetable' | 'class_students' | 'teacher_subject'
  | 'teacher_leave' | 'pending_fee_students' | 'fee_summary' | 'total_staff'
  | 'today_admissions' | 'class_list' | 'sections' | 'subjects' | 'help' | 'unknown';

const INTENT_PATTERNS: { intent: Intent; patterns: RegExp[] }[] = [
  // School summary / overview
  { intent: 'school_summary', patterns: [
    /school (summary|overview|stats|info)/i, /summary of/i, /overview of/i,
    /school (ki )?summary/i, /school ka summary/i, /school ki jankari/i,
    /brief (about|of) (the )?school/i, /tell me about (the )?school/i,
    /school ke baare me/i, /school kaisa hai/i, /how (is|is the) school/i,
  ]},
  // Total students
  { intent: 'total_students', patterns: [
    /how many students/i, /total students/i, /number of students/i,
    /student count/i, /students (count|total)/i, /all students/i,
    /kitne student/i, /kitne bacche/i, /kitne bachche/i, /kitne vidyarthi/i,
    /student kitne hai/i, /bacche kitne hai/i, /total student/i,
    /stude?nt/i, /stundent/i, /vidyarthi/i,
  ]},
  // Total teachers
  { intent: 'total_teachers', patterns: [
    /how many teachers/i, /total teachers/i, /number of teachers/i,
    /teacher count/i, /teachers (count|total)/i, /all teachers/i,
    /kitne teacher/i, /teacher kitne hai/i, /kitne ticher/i, /kitne techer/i,
    /techer kitne/i, /ticher kitne/i, /total teacher/i, /teacher list/i,
    /show (all |the )?teachers/i, /faculty (count|list)/i,
  ]},
  // Total staff
  { intent: 'total_staff', patterns: [
    /how many staff/i, /total staff/i, /staff count/i, /number of staff/i,
    /kitne staff/i, /staff kitne hai/i, /all staff/i,
  ]},
  // Today's attendance
  { intent: 'today_attendance', patterns: [
    /today.?s attendance/i, /attendance today/i, /today attendance/i,
    /aaj (ki )?attendance/i, /aaj kitne present/i, /aaj kitne bacche aaye/i,
    /aaj kitne student aaye/i, /aaj kaun aaya/i, /today.?s present/i,
    /attendance (of |for )today/i, /present (today|count)/i,
    /aaj present/i, /aaj attendance kitni/i, /attendence today/i, /attandance today/i,
  ]},
  // Absent today
  { intent: 'absent_today', patterns: [
    /who (is|are) absent/i, /absent (today|list)/i, /today.?s absent/i,
    /absentees/i, /who (did not|didn.?t) come/i, /who (is|are) not (present|here)/i,
    /aaj kaun absent/i, /aaj kaun nahi aaya/i, /aaj kon absent hai/i,
    /aaj kaun nahi aaya/i, /aaj absent kaun/i, /absent students/i,
    /aaj kitne absent/i, /absent count/i,
  ]},
  // Class attendance
  { intent: 'class_attendance', patterns: [
    /class .* attendance/i, /attendance .* class/i,
    /class .* present/i, /class .* absent/i,
    /class .* me kitne present/i, /class .* me kitne aaye/i,
    /class .* me kaun present/i, /class .* me kaun absent/i,
    /class .* me attendance/i,
  ]},
  // Lowest attendance
  { intent: 'lowest_attendance', patterns: [
    /lowest attendance/i, /which class.*low/i, /class.*lowest/i,
    /kam attendance/i, /sabse kam attendance/i, /worst attendance/i,
    /which class has (low|least|minimum)/i, /lowest.*class/i,
  ]},
  // Pending fees
  { intent: 'pending_fees', patterns: [
    /pending fee/i, /fee pending/i, /fees pending/i, /pending fees/i,
    /outstanding fee/i, /due fee/i, /fee due/i, /unpaid fee/i, /fee not paid/i,
    /kitne fee pending/i, /fee kis kis ki pending/i, /fess pending/i,
    /pending fess/i, /baaki fee/i, /fee baaki/i, /how much fee.*pending/i,
    /total pending fee/i, /fee collection/i, /fee summary/i,
  ]},
  // Pending fee students list
  { intent: 'pending_fee_students', patterns: [
    /which students? (have|has) pending/i, /students? with pending fee/i,
    /list of.*pending fee/i, /show.*pending fee students/i,
    /kis kis ki fee pending/i, /fee pending kis kis ki/i,
    /kis student ki fee pending/i, /pending fee wale student/i,
    /fee nahi diya/i, /fee nahi bhara/i, /fee nahi pay kiya/i,
  ]},
  // Fee summary
  { intent: 'fee_summary', patterns: [
    /fee summary/i, /fee report/i, /fee stats/i, /collection/i,
    /total fee/i, /fee collected/i, /fee status/i, /fees summary/i,
    /fess summary/i, /fee ka summary/i, /fees ka summary/i,
  ]},
  // Latest notices
  { intent: 'latest_notices', patterns: [
    /latest notice/i, /recent notice/i, /notice board/i, /notices/i,
    /announcement/i, /any notice/i, /new notice/i,
    /latest notice/i, /aaj ka notice/i, /naya notice/i,
    /notice kya hai/i, /notice dikhao/i, /notice dikha/i,
  ]},
  // Timetable
  { intent: 'timetable', patterns: [
    /timetable/i, /time table/i, /schedule/i, /today.?s (class|schedule)/i,
    /aaj ka timetable/i, /time table dikhao/i, /class schedule/i,
    /period/i, /aaj ki class/i, /aaj kaun si class/i, /routine/i,
  ]},
  // Class students
  { intent: 'class_students', patterns: [
    /class .* students/i, /students .* class/i, /show class .* students/i,
    /class .* me kitne student/i, /class .* ke student/i,
    /class .* ke bacche/i, /class .* me kaun kaun/i,
    /class .* ki list/i, /students of class/i, /class .* me bacche/i,
  ]},
  // Teacher subject
  { intent: 'teacher_subject', patterns: [
    /which teacher (teaches|for)/i, /teacher (for|of)/i, /who teaches/i,
    /teacher kaun hai/i, /kaun padha raha/i, /kaun padhata/i,
    /teacher kis kaun/i, /subject teacher/i, /teacher of/i,
    /science teacher/i, /maths teacher/i, /math teacher/i,
    /english teacher/i, /hindi teacher/i,
  ]},
  // Teacher leave
  { intent: 'teacher_leave', patterns: [
    /teacher.*leave/i, /leave.*teacher/i, /who.*on leave/i, /on leave/i,
    /kal kis teacher ki leave/i, /aaj kis teacher ki leave/i,
    /teacher absent/i, /teacher on leave/i, /leave request/i,
    /chutti/i, /teacher ki chutti/i, /kaun chutti par/i,
  ]},
  // Today admissions
  { intent: 'today_admissions', patterns: [
    /today.?s admission/i, /admission today/i, /new admission/i,
    /aaj kitne admission/i, /aaj ka admission/i, /admission today/i,
    /new student today/i, /aaj naya admission/i,
  ]},
  // Class list
  { intent: 'class_list', patterns: [
    /class list/i, /all classes/i, /list of classes/i, /how many classes/i,
    /class kitne hai/i, /sabhi class/i, /classes in school/i,
  ]},
  // Sections
  { intent: 'sections', patterns: [
    /section/i, /sections/i, /all sections/i, /section list/i,
    /class .* section/i, /section kitne/i,
  ]},
  // Subjects
  { intent: 'subjects', patterns: [
    /subject/i, /subjects/i, /all subjects/i, /subject list/i,
    /kitne subject/i, /subject kitne/i, /padhaye jane wale subject/i,
  ]},
  // Help
  { intent: 'help', patterns: [
    /help/i, /what can you do/i, /how (to|do i) use/i, /options/i,
    /kya kya kar sakte/i, /kaise use kare/i, /madad/i, /help me/i,
  ]},
];

function detectIntent(message: string): Intent {
  const normalized = message.toLowerCase().trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) return intent;
    }
  }
  return 'unknown';
}

// Extract class identifier from message (e.g., "10A", "8 B", "class 10")
function extractClass(message: string): { classNum?: string; section?: string } | null {
  const m = message.match(/class\s*(\d{1,2})\s*([a-z])?/i) ||
            message.match(/(\d{1,2})\s*([a-z])\s*(?:me|class|section|students|attendance|present|absent|bacche|student)/i) ||
            message.match(/(\d{1,2})\s*-\s*([a-z])/i);
  if (m) return { classNum: m[1], section: m[2]?.toUpperCase() };
  return null;
}

function extractSubject(message: string): string | null {
  const subjects = ['mathematics','maths','math','science','english','hindi','social','sanskrit','computer','biology','chemistry','physics','geography','history','economics'];
  const lower = message.toLowerCase();
  for (const s of subjects) {
    if (lower.includes(s)) return s === 'maths' || s === 'math' ? 'Mathematics' : s.charAt(0).toUpperCase() + s.slice(1);
  }
  return null;
}

// ============================================================
// SECURE DATA ACCESS — RBAC enforced per query
// ============================================================

function createServiceClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

async function getProfile(supabase: any, userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('id, full_name, role, email').eq('id', userId).maybeSingle();
  return data as Profile | null;
}

// Permission check: can this role access fee data?
function canAccessFees(role: string): boolean {
  return ['admin', 'super_admin', 'principal', 'accountant'].includes(role);
}

// Permission check: can this role access academic data?
function canAccessAcademics(role: string): boolean {
  return ['admin', 'super_admin', 'principal', 'teacher'].includes(role);
}

// ============================================================
// QUERY EXECUTION — returns structured data
// ============================================================

async function executeIntent(intent: Intent, message: string, history: any[], profile: Profile, supabase: any): Promise<{ data: any; intent: Intent; error?: string }> {
  const role = profile.role;
  const classInfo = extractClass(message);
  const subject = extractSubject(message);

  switch (intent) {
    case 'school_summary': {
      const [students, staff, teachers, payments, notices, todayAtt] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('role', 'teacher'),
        canAccessFees(role) ? supabase.from('payments').select('amount').eq('is_deleted', false).eq('status', 'completed') : Promise.resolve({ data: [], error: null }),
        supabase.from('notices').select('id').eq('is_deleted', false).eq('is_published', true).limit(1),
        supabase.from('attendance').select('id, status').eq('is_deleted', false).eq('date', new Date().toISOString().slice(0, 10)),
      ]);
      const totalCollection = canAccessFees(role) ? (payments.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0) : null;
      const present = (todayAtt.data || []).filter((a: any) => a.status === 'present').length;
      const total = (todayAtt.data || []).length;
      return { data: { students: students.count || 0, staff: staff.count || 0, teachers: teachers.count || 0, totalCollection, notices: notices.data?.length || 0, todayPresent: present, todayTotal: total }, intent };
    }

    case 'total_students': {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_deleted', false);
      const byClass = await supabase.from('students').select('class_id').eq('is_deleted', false);
      const classCounts: Record<string, number> = {};
      for (const s of byClass.data || []) {
        if (s.class_id) classCounts[s.class_id] = (classCounts[s.class_id] || 0) + 1;
      }
      return { data: { total: count || 0, byClass: classCounts }, intent };
    }

    case 'total_teachers': {
      const { data } = await supabase.from('staff').select('first_name, last_name, department, email').eq('is_deleted', false).eq('role', 'teacher');
      return { data: { teachers: data || [], count: (data || []).length }, intent };
    }

    case 'total_staff': {
      const { count } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('is_deleted', false);
      const { data: byRole } = await supabase.from('staff').select('role').eq('is_deleted', false);
      const roleCounts: Record<string, number> = {};
      for (const s of byRole || []) roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
      return { data: { total: count || 0, byRole: roleCounts }, intent };
    }

    case 'today_attendance': {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from('attendance').select('id, status, person_type').eq('is_deleted', false).eq('date', today);
      const records = data || [];
      const present = records.filter((a: any) => a.status === 'present').length;
      const absent = records.filter((a: any) => a.status === 'absent').length;
      const total = records.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return { data: { present, absent, total, rate }, intent };
    }

    case 'absent_today': {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from('attendance').select('person_id, person_type, status').eq('is_deleted', false).eq('date', today).eq('status', 'absent');
      const absentees = data || [];
      let studentDetails: any[] = [];
      if (absentees.some((a: any) => a.person_type === 'student')) {
        const studentIds = absentees.filter((a: any) => a.person_type === 'student').map((a: any) => a.person_id);
        if (studentIds.length) {
          const { data: students } = await supabase.from('students').select('id, first_name, last_name, admission_number, class_id').in('id', studentIds);
          studentDetails = students || [];
        }
      }
      return { data: { count: absentees.length, students: studentDetails }, intent };
    }

    case 'class_attendance': {
      if (!classInfo) return { data: null, intent, error: 'Please specify a class (e.g., "Class 10A attendance")' };
      const today = new Date().toISOString().slice(0, 10);
      let classQuery = supabase.from('classes').select('id, class_numeric, class_name').eq('is_deleted', false);
      if (classInfo.classNum) classQuery = classQuery.eq('class_numeric', parseInt(classInfo.classNum));
      const { data: classes } = await classQuery;
      if (!classes?.length) return { data: null, intent, error: `Class ${classInfo.classNum} not found` };
      const classIds = classes.map((c: any) => c.id);
      const { data: students } = await supabase.from('students').select('id, first_name, last_name, section_id').eq('is_deleted', false).in('class_id', classIds);
      const studentIds = (students || []).map((s: any) => s.id);
      if (!studentIds.length) return { data: { present: 0, absent: 0, total: 0, rate: 0, students: [] }, intent };
      const { data: att } = await supabase.from('attendance').select('person_id, status').eq('is_deleted', false).eq('date', today).eq('person_type', 'student').in('person_id', studentIds);
      const present = (att || []).filter((a: any) => a.status === 'present').length;
      const absent = (att || []).filter((a: any) => a.status === 'absent').length;
      const presentStudents = (students || []).filter((s: any) => (att || []).some((a: any) => a.person_id === s.id && a.status === 'present'));
      return { data: { present, absent, total: studentIds.length, rate: studentIds.length > 0 ? Math.round((present / studentIds.length) * 100) : 0, students: presentStudents }, intent };
    }

    case 'lowest_attendance': {
      const today = new Date().toISOString().slice(0, 10);
      const { data: classes } = await supabase.from('classes').select('id, class_numeric, class_name').eq('is_deleted', false);
      const { data: students } = await supabase.from('students').select('id, class_id').eq('is_deleted', false);
      const { data: att } = await supabase.from('attendance').select('person_id, status').eq('is_deleted', false).eq('date', today).eq('person_type', 'student');
      const results: { className: string; total: number; present: number; rate: number }[] = [];
      for (const c of classes || []) {
        const classStudents = (students || []).filter((s: any) => s.class_id === c.id);
        const classAtt = (att || []).filter((a: any) => classStudents.some((s: any) => s.id === a.person_id));
        const present = classAtt.filter((a: any) => a.status === 'present').length;
        const rate = classStudents.length > 0 ? Math.round((present / classStudents.length) * 100) : 0;
        results.push({ className: c.class_name || `Class ${c.class_numeric}`, total: classStudents.length, present, rate });
      }
      results.sort((a, b) => a.rate - b.rate);
      return { data: { classes: results.slice(0, 5) }, intent };
    }

    case 'pending_fees': {
      if (!canAccessFees(role)) return { data: null, intent, error: "You don't have permission to access fee information." };
      const { data: payments } = await supabase.from('payments').select('amount, status, due_date, student_id').eq('is_deleted', false);
      const pending = (payments || []).filter((p: any) => p.status !== 'completed');
      const totalPending = pending.reduce((s: number, p: any) => s + Number(p.amount), 0);
      return { data: { count: pending.length, totalPending }, intent };
    }

    case 'pending_fee_students': {
      if (!canAccessFees(role)) return { data: null, intent, error: "You don't have permission to access fee information." };
      const { data: payments } = await supabase.from('payments').select('id, amount, status, due_date, student_id').eq('is_deleted', false).neq('status', 'completed');
      const studentIds = (payments || []).map((p: any) => p.student_id).filter(Boolean);
      let students: any[] = [];
      if (studentIds.length) {
        const { data: studentData } = await supabase.from('students').select('id, first_name, last_name, admission_number, class_id').in('id', studentIds);
        students = studentData || [];
      }
      const result = (payments || []).map((p: any) => {
        const student = students.find((s: any) => s.id === p.student_id);
        return { name: student ? `${student.first_name} ${student.last_name}` : 'Unknown', admissionNo: student?.admission_number || 'N/A', amount: p.amount, dueDate: p.due_date };
      });
      return { data: { students: result, count: result.length, totalPending: result.reduce((s: number, r: any) => s + Number(r.amount), 0) }, intent };
    }

    case 'fee_summary': {
      if (!canAccessFees(role)) return { data: null, intent, error: "You don't have permission to access fee information." };
      const { data: payments } = await supabase.from('payments').select('amount, status').eq('is_deleted', false);
      const all = payments || [];
      const collected = all.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + Number(p.amount), 0);
      const pending = all.filter((p: any) => p.status !== 'completed').reduce((s: number, p: any) => s + Number(p.amount), 0);
      return { data: { collected, pending, total: collected + pending, collectedCount: all.filter((p: any) => p.status === 'completed').length, pendingCount: all.filter((p: any) => p.status !== 'completed').length }, intent };
    }

    case 'latest_notices': {
      const { data } = await supabase.from('notices').select('id, title, description, priority, author_name, author_role, publish_date, expiry_date').eq('is_deleted', false).eq('is_published', true).order('publish_date', { ascending: false }).limit(5);
      return { data: { notices: data || [] }, intent };
    }

    case 'timetable': {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const { data } = await supabase.from('timetable').select('id, day_of_week, period_number, start_time, end_time, subject_id, teacher_id, class_id, section_id').eq('is_deleted', false).eq('day_of_week', today).order('period_number');
      let enriched = data || [];
      if (enriched.length) {
        const teacherIds = [...new Set(enriched.map((t: any) => t.teacher_id).filter(Boolean))];
        const subjectIds = [...new Set(enriched.map((t: any) => t.subject_id).filter(Boolean))];
        const classIds = [...new Set(enriched.map((t: any) => t.class_id).filter(Boolean))];
        const [teachers, subjects, classes] = await Promise.all([
          teacherIds.length ? supabase.from('staff').select('id, first_name, last_name').in('id', teacherIds) : Promise.resolve({ data: [] }),
          subjectIds.length ? supabase.from('subjects').select('id, name').in('id', subjectIds) : Promise.resolve({ data: [] }),
          classIds.length ? supabase.from('classes').select('id, class_name').in('id', classIds) : Promise.resolve({ data: [] }),
        ]);
        enriched = enriched.map((t: any) => ({
          ...t,
          teacher: (teachers.data || []).find((s: any) => s.id === t.teacher_id),
          subject: (subjects.data || []).find((s: any) => s.id === t.subject_id),
          class: (classes.data || []).find((s: any) => s.id === t.class_id),
        }));
      }
      return { data: { timetable: enriched, day: today }, intent };
    }

    case 'class_students': {
      if (!classInfo) return { data: null, intent, error: 'Please specify a class (e.g., "Show Class 10A students")' };
      let classQuery = supabase.from('classes').select('id, class_numeric, class_name').eq('is_deleted', false);
      if (classInfo.classNum) classQuery = classQuery.eq('class_numeric', parseInt(classInfo.classNum));
      const { data: classes } = await classQuery;
      if (!classes?.length) return { data: null, intent, error: `Class ${classInfo.classNum} not found` };
      const classIds = classes.map((c: any) => c.id);
      const { data: students } = await supabase.from('students').select('id, first_name, last_name, admission_number, status, class_id').eq('is_deleted', false).in('class_id', classIds);
      return { data: { students: students || [], className: classes[0].class_name || `Class ${classInfo.classNum}` }, intent };
    }

    case 'teacher_subject': {
      let query = supabase.from('teacher_class_assignments').select('id, teacher_id, subject_id, class_id, is_active').eq('is_deleted', false).eq('is_active', true);
      const { data: assignments } = await query;
      let enriched = assignments || [];
      if (subject) {
        const { data: subjects } = await supabase.from('subjects').select('id, name').ilike('name', `%${subject}%`);
        const subjectIds = (subjects || []).map((s: any) => s.id);
        enriched = enriched.filter((a: any) => subjectIds.includes(a.subject_id));
      }
      if (enriched.length) {
        const teacherIds = [...new Set(enriched.map((a: any) => a.teacher_id).filter(Boolean))];
        const subjectIds = [...new Set(enriched.map((a: any) => a.subject_id).filter(Boolean))];
        const classIds = [...new Set(enriched.map((a: any) => a.class_id).filter(Boolean))];
        const [teachers, subjects, classes] = await Promise.all([
          teacherIds.length ? supabase.from('staff').select('id, first_name, last_name, department').in('id', teacherIds) : Promise.resolve({ data: [] }),
          subjectIds.length ? supabase.from('subjects').select('id, name').in('id', subjectIds) : Promise.resolve({ data: [] }),
          classIds.length ? supabase.from('classes').select('id, class_name').in('id', classIds) : Promise.resolve({ data: [] }),
        ]);
        enriched = enriched.map((a: any) => ({
          teacher: (teachers.data || []).find((t: any) => t.id === a.teacher_id),
          subject: (subjects.data || []).find((s: any) => s.id === a.subject_id),
          class: (classes.data || []).find((c: any) => c.id === a.class_id),
        }));
      }
      return { data: { assignments: enriched }, intent };
    }

    case 'teacher_leave': {
      const { data } = await supabase.from('leave_requests').select('id, user_id, start_date, end_date, reason, status, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10);
      let enriched = data || [];
      if (enriched.length) {
        const userIds = [...new Set(enriched.map((l: any) => l.user_id).filter(Boolean))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', userIds);
        enriched = enriched.map((l: any) => ({
          ...l,
          user: (profiles || []).find((p: any) => p.id === l.user_id),
        }));
      }
      return { data: { leaveRequests: enriched }, intent };
    }

    case 'today_admissions': {
      const today = new Date().toISOString().slice(0, 10);
      const { count, data } = await supabase.from('students').select('id, first_name, last_name, admission_number, admission_date').eq('is_deleted', false).eq('admission_date', today);
      return { data: { count: count || 0, students: data || [] }, intent };
    }

    case 'class_list': {
      const { data } = await supabase.from('classes').select('id, class_numeric, class_name').eq('is_deleted', false).order('class_numeric', { ascending: true });
      return { data: { classes: data || [] }, intent };
    }

    case 'sections': {
      const { data } = await supabase.from('sections').select('id, name, class_id').eq('is_deleted', false).order('name');
      return { data: { sections: data || [] }, intent };
    }

    case 'subjects': {
      const { data } = await supabase.from('subjects').select('id, name, code').eq('is_deleted', false).order('name');
      return { data: { subjects: data || [] }, intent };
    }

    case 'help':
      return { data: null, intent };

    default:
      return { data: null, intent: 'unknown' as Intent };
  }
}

// ============================================================
// RESPONSE FORMATTING — beautiful, structured responses
// ============================================================

function formatResponse(intent: Intent, data: any, error?: string): string {
  if (error) return `⚠️ ${error}`;

  switch (intent) {
    case 'school_summary': {
      const d = data;
      let lines = [
        '📊 **School Summary**',
        '',
        `👨‍🎓 **Total Students:** ${d.students}`,
        `👨‍🏫 **Total Teachers:** ${d.teachers}`,
        `👥 **Total Staff:** ${d.staff}`,
      ];
      if (d.totalCollection !== null) {
        lines.push(`💰 **Total Fee Collection:** ₹${d.totalCollection?.toLocaleString('en-IN') || 0}`);
      }
      if (d.todayTotal > 0) {
        lines.push(`📅 **Today's Attendance:** ${d.todayPresent}/${d.todayTotal} (${Math.round((d.todayPresent / d.todayTotal) * 100)}%)`);
      }
      lines.push('', 'How can I help you with more details?');
      return lines.join('\n');
    }

    case 'total_students': {
      const d = data;
      let lines = [
        '👨‍🎓 **Student Count**',
        '',
        `**Total Students:** ${d.total}`,
      ];
      if (d.byClass && Object.keys(d.byClass).length > 0) {
        lines.push('', '**Class-wise breakdown:**');
        for (const [classId, count] of Object.entries(d.byClass)) {
          lines.push(`• Class ${classId}: ${count} students`);
        }
      }
      return lines.join('\n');
    }

    case 'total_teachers': {
      const d = data;
      let lines = [
        '👨‍🏫 **Teacher List**',
        '',
        `**Total Teachers:** ${d.count}`,
        '',
      ];
      if (d.teachers.length) {
        lines.push('| Name | Department | Email |');
        lines.push('|------|------------|-------|');
        for (const t of d.teachers.slice(0, 10)) {
          lines.push(`| ${t.first_name} ${t.last_name} | ${t.department || 'N/A'} | ${t.email || 'N/A'} |`);
        }
        if (d.teachers.length > 10) lines.push('', `*...and ${d.teachers.length - 10} more teachers*`);
      }
      return lines.join('\n');
    }

    case 'total_staff': {
      const d = data;
      let lines = [
        '👥 **Staff Summary**',
        '',
        `**Total Staff:** ${d.total}`,
      ];
      if (d.byRole && Object.keys(d.byRole).length > 0) {
        lines.push('', '**Role-wise breakdown:**');
        for (const [role, count] of Object.entries(d.byRole)) {
          lines.push(`• ${role.charAt(0).toUpperCase() + role.slice(1)}: ${count}`);
        }
      }
      return lines.join('\n');
    }

    case 'today_attendance': {
      const d = data;
      return [
        '📅 **Today\'s Attendance Summary**',
        '',
        `✅ **Present:** ${d.present}`,
        `❌ **Absent:** ${d.absent}`,
        `📊 **Total:** ${d.total}`,
        `📈 **Attendance Rate:** ${d.rate}%`,
        '',
        d.rate >= 90 ? '🎉 Great attendance today!' : d.rate >= 75 ? '👍 Attendance is decent.' : '⚠️ Attendance needs attention.',
      ].join('\n');
    }

    case 'absent_today': {
      const d = data;
      if (d.count === 0) return '🎉 **Great news!** No students are absent today. Full attendance!';
      let lines = [
        '📋 **Today\'s Absentees**',
        '',
        `**Total Absent:** ${d.count}`,
      ];
      if (d.students.length) {
        lines.push('', '| Name | Admission No | Class |');
        lines.push('|------|-------------|-------|');
        for (const s of d.students.slice(0, 15)) {
          lines.push(`| ${s.first_name} ${s.last_name} | ${s.admission_number || 'N/A'} | ${s.class_id || 'N/A'} |`);
        }
        if (d.students.length > 15) lines.push('', `*...and ${d.students.length - 15} more*`);
      }
      return lines.join('\n');
    }

    case 'class_attendance': {
      const d = data;
      return [
        '📅 **Class Attendance**',
        '',
        `✅ **Present:** ${d.present}`,
        `❌ **Absent:** ${d.absent}`,
        `📊 **Total:** ${d.total}`,
        `📈 **Attendance Rate:** ${d.rate}%`,
      ].join('\n');
    }

    case 'lowest_attendance': {
      const d = data;
      if (!d.classes.length) return 'No attendance data available for today.';
      let lines = [
        '📉 **Classes with Lowest Attendance**',
        '',
        '| Class | Total | Present | Rate |',
        '|-------|-------|---------|------|',
      ];
      for (const c of d.classes) {
        lines.push(`| ${c.className} | ${c.total} | ${c.present} | ${c.rate}% |`);
      }
      const lowest = d.classes[0];
      lines.push('', `⚠️ **Recommendation:** ${lowest.className} has the lowest attendance at ${lowest.rate}%. Consider following up with absent students.`);
      return lines.join('\n');
    }

    case 'pending_fees': {
      const d = data;
      return [
        '💰 **Pending Fee Summary**',
        '',
        `**Pending Count:** ${d.count}`,
        `**Total Pending Amount:** ₹${d.totalPending.toLocaleString('en-IN')}`,
      ].join('\n');
    }

    case 'pending_fee_students': {
      const d = data;
      if (!d.students.length) return '✅ No students have pending fees. All fees are paid!';
      let lines = [
        '💰 **Students with Pending Fees**',
        '',
        `**Total Pending:** ₹${d.totalPending.toLocaleString('en-IN')} (${d.count} students)`,
        '',
        '| Student | Admission No | Amount | Due Date |',
        '|---------|-------------|--------|----------|',
      ];
      for (const s of d.students.slice(0, 15)) {
        lines.push(`| ${s.name} | ${s.admissionNo} | ₹${Number(s.amount).toLocaleString('en-IN')} | ${s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-IN') : 'N/A'} |`);
      }
      if (d.students.length > 15) lines.push('', `*...and ${d.students.length - 15} more*`);
      return lines.join('\n');
    }

    case 'fee_summary': {
      const d = data;
      return [
        '💰 **Fee Summary**',
        '',
        `✅ **Collected:** ₹${d.collected.toLocaleString('en-IN')} (${d.collectedCount} payments)`,
        `⏳ **Pending:** ₹${d.pending.toLocaleString('en-IN')} (${d.pendingCount} pending)`,
        `📊 **Total:** ₹${d.total.toLocaleString('en-IN')}`,
        '',
        d.pending > 0 ? `⚠️ ${d.pendingCount} payments are still pending. Follow-up recommended.` : '🎉 All fees collected!',
      ].join('\n');
    }

    case 'latest_notices': {
      const d = data;
      if (!d.notices.length) return '📭 No notices published yet.';
      let lines = ['📢 **Latest Notices**', ''];
      for (const n of d.notices) {
        const priEmoji = n.priority === 'urgent' ? '🔴' : n.priority === 'high' ? '🟠' : n.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`${priEmoji} **${n.title}**`);
        lines.push(`   ${n.description.slice(0, 100)}${n.description.length > 100 ? '...' : ''}`);
        lines.push(`   📅 ${new Date(n.publish_date).toLocaleDateString('en-IN')} · 👤 ${n.author_name} (${n.author_role})`);
        lines.push('');
      }
      return lines.join('\n');
    }

    case 'timetable': {
      const d = data;
      if (!d.timetable.length) return `📭 No timetable entries for ${d.day.charAt(0).toUpperCase() + d.day.slice(1)}.`;
      let lines = [`📅 **Today's Timetable (${d.day.charAt(0).toUpperCase() + d.day.slice(1)})**`, '', '| Period | Time | Subject | Teacher | Class |', '|--------|------|---------|---------|-------|'];
      for (const t of d.timetable) {
        const teacher = t.teacher ? `${t.teacher.first_name} ${t.teacher.last_name}` : 'N/A';
        const subject = t.subject?.name || 'N/A';
        const cls = t.class?.class_name || 'N/A';
        const time = `${t.start_time || ''} - ${t.end_time || ''}`;
        lines.push(`| ${t.period_number} | ${time} | ${subject} | ${teacher} | ${cls} |`);
      }
      return lines.join('\n');
    }

    case 'class_students': {
      const d = data;
      if (!d.students.length) return `📭 No students found in ${d.className}.`;
      let lines = [
        `👨‍🎓 **${d.className} Students (${d.students.length})**`,
        '',
        '| Name | Admission No | Status |',
        '|------|-------------|--------|',
      ];
      for (const s of d.students.slice(0, 20)) {
        lines.push(`| ${s.first_name} ${s.last_name} | ${s.admission_number || 'N/A'} | ${s.status || 'Active'} |`);
      }
      if (d.students.length > 20) lines.push('', `*...and ${d.students.length - 20} more*`);
      return lines.join('\n');
    }

    case 'teacher_subject': {
      const d = data;
      if (!d.assignments.length) return '📭 No teacher assignments found.';
      let lines = ['👨‍🏫 **Teacher Assignments**', '', '| Teacher | Subject | Class |', '|---------|---------|-------|'];
      for (const a of d.assignments.slice(0, 15)) {
        const teacher = a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name}` : 'N/A';
        const subject = a.subject?.name || 'N/A';
        const cls = a.class?.class_name || 'N/A';
        lines.push(`| ${teacher} | ${subject} | ${cls} |`);
      }
      return lines.join('\n');
    }

    case 'teacher_leave': {
      const d = data;
      if (!d.leaveRequests.length) return '✅ No recent leave requests.';
      let lines = ['📋 **Recent Leave Requests**', '', '| Teacher | Dates | Status | Reason |', '|---------|-------|--------|--------|'];
      for (const l of d.leaveRequests.slice(0, 10)) {
        const name = l.user?.full_name || 'Unknown';
        const dates = `${new Date(l.start_date).toLocaleDateString('en-IN')} - ${new Date(l.end_date).toLocaleDateString('en-IN')}`;
        lines.push(`| ${name} | ${dates} | ${l.status} | ${l.reason || 'N/A'} |`);
      }
      return lines.join('\n');
    }

    case 'today_admissions': {
      const d = data;
      if (d.count === 0) return '📭 No new admissions today.';
      let lines = [`🎓 **Today's Admissions (${d.count})**`, ''];
      for (const s of d.students) {
        lines.push(`• ${s.first_name} ${s.last_name} (${s.admission_number || 'N/A'})`);
      }
      return lines.join('\n');
    }

    case 'class_list': {
      const d = data;
      if (!d.classes.length) return '📭 No classes found.';
      let lines = ['📚 **Class List**', ''];
      for (const c of d.classes) {
        lines.push(`• ${c.class_name || `Class ${c.class_numeric}`}`);
      }
      return lines.join('\n');
    }

    case 'sections': {
      const d = data;
      if (!d.sections.length) return '📭 No sections found.';
      let lines = ['📚 **Sections**', ''];
      for (const s of d.sections) {
        lines.push(`• ${s.name}`);
      }
      return lines.join('\n');
    }

    case 'subjects': {
      const d = data;
      if (!d.subjects.length) return '📭 No subjects found.';
      let lines = ['📚 **Subjects**', ''];
      for (const s of d.subjects) {
        lines.push(`• ${s.name}${s.code ? ` (${s.code})` : ''}`);
      }
      return lines.join('\n');
    }

    case 'help':
      return [
        '🤖 **AI School Assistant — Help**',
        '',
        'I can help you with:',
        '• 📊 School summary & statistics',
        '• 👨‍🎓 Student information & counts',
        '• 👨‍🏫 Teacher lists & assignments',
        '• 📅 Attendance (today, by class, absentees)',
        '• 💰 Fee summary & pending fees',
        '• 📢 Latest notices',
        '• 📅 Today\'s timetable',
        '• 📝 Leave requests',
        '• 🎓 Admissions',
        '',
        'I understand English, Hindi, and Hinglish!',
        'Just ask me naturally, like: "Aaj kitne students present hain?"',
      ].join('\n');

    default:
      return [
        '🤔 I\'m not sure how to help with that yet.',
        '',
        'I can answer questions about:',
        '• Students, Teachers, and Staff',
        '• Attendance and Absentees',
        '• Fees and Pending payments',
        '• Notices and Announcements',
        '• Timetable and Classes',
        '• Leave requests',
        '',
        'Try asking: "Show me today\'s attendance" or "Aaj kitne bacche aaye?"',
      ].join('\n');
  }
}

// ============================================================
// CONTEXT MEMORY — resolve references from history
// ============================================================

function resolveContext(message: string, history: any[]): string {
  if (!history.length) return message;
  const lower = message.toLowerCase();

  // "inme" (in these) / "in sabhi" (in all of these) refers to previous entity
  if (lower.includes('inme') || lower.includes('in sabhi') || lower.includes('in sab') || lower.includes('isme')) {
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      // Check if previous context was about a class
      const classMatch = lastAssistant.content.match(/Class (\d{1,2}[A-Z]?)/i);
      if (classMatch) {
        return message + ` (referring to Class ${classMatch[1]})`;
      }
    }
  }

  // "attendance bhi dikhao" (also show attendance) — keep context
  if (lower.includes('bhi dikhao') || lower.includes('bhi batao') || lower.includes('bhi show')) {
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    if (lastUser && lastUser.content !== message) {
      const classMatch = lastUser.content.match(/class (\d{1,2}\s*[a-z]?)/i);
      if (classMatch) {
        return `${message} for class ${classMatch[1]}`;
      }
    }
  }

  return message;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, history, userId } = await req.json() as ChatRequest;

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: 'Missing message or userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServiceClient(req);
    const profile = await getProfile(supabase, userId);

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RBAC: Students have no access
    if (profile.role === 'student') {
      const response = '🚫 You do not have access to the AI Assistant. Please contact your school administrator if you need help.';
      return new Response(JSON.stringify({ response, intent: 'unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve context references
    const resolvedMessage = resolveContext(message, history || []);

    // Check if LLM (Gemini) API key is available — use tool-calling LLM if so
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (geminiApiKey) {
      try {
        const toolCtx: ToolContext = { supabase, role: profile.role, userId: profile.id };
        const llmResult = await runLLMWithTools(resolvedMessage, history || [], toolCtx, geminiApiKey);

        return new Response(JSON.stringify({
          response: llmResult.response,
          intent: llmResult.intent,
          toolsUsed: llmResult.toolsUsed,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (llmErr) {
        console.error("LLM error, falling back to rule-based:", llmErr.message);
        // Fall through to rule-based system
      }
    }

    // Detect intent (rule-based fallback)
    const intent = detectIntent(resolvedMessage);

    // Execute query with RBAC
    const result = await executeIntent(intent, resolvedMessage, history || [], profile, supabase);

    // Format response
    const response = formatResponse(result.intent, result.data, result.error);

    return new Response(JSON.stringify({
      response,
      intent: result.intent,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Something went wrong. Please try again.',
      details: err.message,
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
