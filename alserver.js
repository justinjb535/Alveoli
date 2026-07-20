import express from "express";
import "dotenv/config";
import cors from "cors";
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from "./supabase.js";
import {authC} from "./auth.js";
import registerRouter from "./register.js";
import teacherRoute from "./teacher.js";
//import meRoute from "./routes/me.js";

const app = express();
const Port = process.env.Port || 2000;
const supabase = supabaseAdmin;

app.use(express.json());
app.use(cors({origin :"*"}));
app.use('/register',registerRouter);
app.use("/api/teachers",teacherRoute);
//app.use("/", meRoute);

app.get("/me",authC,async (req, res) => {
  console.log("hit /me");
  const token = req.headers.authorization?.split(" ")[1];
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);

  console.log("USER ID:", user.id); // <-- add this

  const { data: school } = await supabaseAdmin
   .from("schools")
   .select("id")
   .eq("owner_id", user.id)
   .maybeSingle();

  console.log("SCHOOL FOUND:", school); // <-- add this

  if (school) return res.json({ exists: true, user });
  return res.status(404).json({ exists: false });
});

app.get('/school/profile', authC, async (req,res) => {
  try {
    const owner_id = req.user.id;
 
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('owner_id', owner_id)
      .single();

    if(error) throw error;

    res.json({ success: true, school: data });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DASHBOARD STATS - put this with your other app.get/app.post routes
app.get('/dashboard-stats', authC, async (req,res)=>{
  try {
    const owner_id = req.user.id; // authC already gives us this

    // 1. Get expected counts from schools table
    const { data: school } = await supabase
     .from('schools')
     .select('student_count, teacher_count, seat_limit')
     .eq('owner_id', owner_id)
     .single();

    const expected_students = school?.student_count || 0;
    const expected_teachers = school?.teacher_count || 0;
    const device_limit = school?.seat_limit || (expected_teachers + 2);

    // 2. Get actual counts from students table
    const { data: students } = await supabase
     .from('students')
     .select('grade')
     .eq('owner_id', owner_id);

    const actual_students = students?.length || 0;

    // Count per grade
    const gradeCounts = { 'Form 1':0, 'Form 2':0, 'Form 3':0, 'Form 4':0 };
    students?.forEach(s => {
      if(gradeCounts[s.grade] !== undefined) gradeCounts[s.grade]++;
    });

    // 3. Get fees collected total
    const { data: payments } = await supabase
     .from('fees_payments')
     .select('amount')
     .eq('owner_id', owner_id);

    const fees_collected = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    res.json({
      success: true,
      expected_students,
      actual_students,
      expected_teachers,
      actual_teachers: expected_teachers, // we’ll upgrade this later
      device_limit,
      gradeCounts,
      fees_collected
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
   console.log("everything loaded");
});

function isOnlyText(text) {
  // only letters, spaces, . ' -
  const regex = /^[a-zA-Z\s.'-]+$/;
  return regex.test(text.trim()) && text.trim().length > 0;
}
function validatePhone(pP) {
  const trimmed = pP.trim();
  // Local numbers: 10 digits
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length < 10) {
      const missing = 10 - trimmed.length;
      return { valid: false, message: `Phone number is too short. Add ${missing} more digit(s).` };
    }
    if (trimmed.length > 10) {
      return { valid: false, message: "Local phone number must be exactly 10 digits." };
    }
    return { valid: true };
  }

  // International numbers: + followed by 11–15 digits
  if (/^\+\d+$/.test(trimmed)) {
    if (trimmed.length < 12) { // + plus at least 11 digits
      const missing = 12 - trimmed.length;
      return { valid: false, message: `International number too short. Add ${missing} more digit(s).` };
    }
    if (trimmed.length > 16) {
      return { valid: false, message: "International number too long." };
    }
    return { valid: true };
  }

  return { valid: false, message: "Invalid phone number format." };
}

app.post('/generate/studentNumber', authC, async (req,res)=>{
 try{
  console.log("HIT /generate/studentNumber");
  const {stNm, dob, grade, pNm, pP} = req.body;

  // FIXED: Added ! in front of isOnlyText
  if(!stNm || !isOnlyText(stNm)){
   return res.status(400).json({success:false, message:"Full name must only contain letters"});
  }
  if (!pNm || !isOnlyText(pNm)) {
   return res.status(400).json({ success:false, message:"Parent name must only contain letters" });
  }

  if (pNm.trim() === stNm.trim()) {
   return res.status(400).json({ success:false, message:"Parent name cannot be the same as student name" });
  }
  if(!dob || !grade) {
    return res.status(400).json({success:false, message:"DOB and Grade required"});
  }
  const phoneCheck = validatePhone(pP);

  if(!phoneCheck.valid){
    return res.status(400).json({success:false, message:phoneCheck.message});
  }
  const owner_id = req.user.id; // <- you logged this as .value not .id
  const year = new Date().getFullYear().toString().slice(-2);

  if(!owner_id) {
    return res.status(401).json({success:false, message: "Auth failed. No school_id"})
  }

  // 1. Check duplicate student
  const { data: existing } = await supabase
   .from('students')
   .select('student_number')
   .eq('owner_id', owner_id)
   .ilike('full_name', stNm)
   .eq('date_of_birth', dob)
   .eq('grade', grade)
   .limit(1);

  if (existing?.length) {
   return res.status(400).json({success:false, message:`${stNm} already has SID:${existing[0].student_number}`});
  }

  let studentNo;
  // 2. Try up to 5 times
  for(let i = 0; i < 5; i++) {
    const { data: allThisYear } = await supabase
     .from('students').select('student_number')
     .eq('owner_id', owner_id).like('student_number', `SID${year}%`);

    let maxNum = 0;
    allThisYear?.forEach(s => { const num = parseInt(s.student_number.slice(-4)); if (num > maxNum) maxNum = num; });
    studentNo = `SID${year}${String(maxNum + 1).padStart(4,"0")}`;

    const { error } = await supabase.from("students").insert({
      owner_id, student_number: studentNo, full_name: stNm.trim(), // added trim
      date_of_birth: dob, grade, parent_name: pNm, parent_phone: pP,school_name:req.user.user_metadata?.school_name || null,
      registered_at: new Date().toISOString()
    });

    if (!error) {
       console.log(`NEW STUDENT REGISTERED - SKYIE-INDUSTRIES`);
       console.log(`Name:${stNm} | SID:${studentNo}`);
       console.log(`DOB:${dob} | Grade:${grade}`);
      return res.json({ success:true, studentNo });
    }
    if (error.code !== '23505') return res.status(400).json({ success: false, message: error.message });
    await new Promise(r => setTimeout(r, 50));
  }

  return res.status(500).json({ success: false, message: "Could not generate unique SID" });

 }catch(error){
  console.error("ROUTE CRASHED:", error); 
  res.status(500).json({ success:false, message: error.message || "server failed" });
 }
});

app.get('/stats/students',authC, async (req,res)=>{
  try {
   console.log("req.user.type",typeof req.user.id);
   console.log("req.user.value",req.user.id);
    const owner_id = req.user.id;
    
    const { data, error } = await supabase
      .from('students')
      .select('grade')
      .eq('owner_id', owner_id);

    if (error) return res.json({ success: false, message: error.message });

    const perGrade = { F1: 0, F2: 0, F3: 0, F4: 0 };
    data?.forEach(s => { 
      if (perGrade[s.grade] !== undefined) perGrade[s.grade]++; 
    });

    res.json({
      success: true,
      totalStudents: data?.length || 0,
      perGrade
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.post('/subjects/add',authC, express.json(), async (req,res)=>{
  try {
    const { subject } = req.body;
    const owner_id  = req.user.id;

    if(!subject) return res.json({ success: false, message: "Subject cannot be empty"});

    const { data: exists } = await supabase
      .from('subjects')
      .select('id')
      .eq('owner_id',owner_id)
      .eq('name', subject)
      .single();

    if(exists) return res.json({ success: false, message: "Subject already exists"});

    const { error: insertError } = await supabase
      .from('subjects')
      .insert({ owner_id, name: subject });

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.json({ success: false, message: insertError.message });
    }

    const { data } = await supabase
      .from('subjects')
      .select('name')
      .eq('owner_id', owner_id)
      .order('name');

    res.json({ success: true, subjects: data?.map(d => d.name) || [] });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.get('/subjects', authC, async (req,res)=>{
  try {
    console.log("GET/SUBJECTS CALLED");
    const owner_id = req.user.id; // ✅ declare it here

    const { data, error } = await supabase
      .from('subjects')
      .select('name')
      .eq('owner_id', owner_id)
      .order('name');

    if (error) {
      console.error("Supabase error:", error);
      return res.json({ success: false, message: error.message });
    }

    res.json({ success: true, subjects: data?.map(d => d.name) || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.get('/students/grade/:grade',authC, async (req,res)=>{
  try {
    const grade = req.params.grade;
    const owner_id = req.user.id;

    const { data } = await supabase
      .from('students')
      .select('student_number, full_name')
      .eq('owner_id', owner_id)
      .eq('grade', grade)
      .order('full_name');

    const students = data?.map(s => ({ id: s.student_number, name: s.full_name })) || [];
    res.json({ success: true, students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.post('/marks/save', authC, express.json(), async (req, res) => {
  try {
    //console.log("req.user.type",typeof req.user.id);
   // console.log("req.user.value",req.user.id);
    const { grade, subject, term, paperNo, total, marks } = req.body; // marks = [{studentId, mark}]
    const owner_id = req.user.id;

    const rows = marks.map(m => ({
      owner_id,
      student_id: m.studentId,
      subject,
      grade,
      term,
      paper_no: paperNo,
      total_marks: total,
      score: m.mark,
      date: new Date().toISOString()
    }));

    const { error } = await supabase.from("marks").insert(rows);
    if (error) return res.status(400).json({ success: false, message: error.message });

    res.json({ success: true, message: "Marks saved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.get('/dashboard/passrate', authC, async (req,res)=>{
  try {
    const owner_id = req.user.id;
    const { grade, term } = req.query; // e.g. /dashboard/passrate?grade=12&term=Term1
    const PASS_MARK = 50; // change this if your school uses 40

    // 1. Get total students in that grade
    const { data: students, error: sErr } = await supabase
     .from('students')
     .select('student_number')
     .eq('owner_id', owner_id)
     .eq('grade', grade);

    if(sErr) throw sErr;
    const totalStudents = students.length;
    if(totalStudents === 0) return res.json({ success: true, passRate: 0, total: 0, passed: 0 });

    const studentIds = students.map(s => s.student_number);

    // 2. Get average mark per student for that term + grade
    const { data: marks, error: mErr } = await supabase
     .from('marks')
     .select('student_id, score, total_marks')
     .eq('owner_id', owner_id)
     .eq('grade', grade)
     .eq('term', term)
     .in('student_id', studentIds);

    if(mErr) throw mErr;

    // 3. Calculate % per student, then see if they passed
    const studentScores = {};
    marks.forEach(m => {
      if(!studentScores[m.student_id]) studentScores[m.student_id] = { total: 0, count: 0 };
      studentScores[m.student_id].total += (m.score / m.total_marks) * 100; // convert to %
      studentScores[m.student_id].count += 1;
    });

    let passedCount = 0;
    studentIds.forEach(id => {
      const s = studentScores[id];
      if(s && s.count > 0) {
        const avg = s.total / s.count; // average % across all subjects
        if(avg >= PASS_MARK) passedCount++;
      }
      // if student has no marks at all, they count as "not passed"
    });

    const passRate = Math.round((passedCount / totalStudents) * 100);

    res.json({
      success: true,
      passRate,
      total: totalStudents,
      passed: passedCount,
      failed: totalStudents - passedCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.get('/students/list/:grade',authC,async (req,res)=>{
  try {
    console.log("req.user.type",typeof req.user.id);
    console.log("req.user.value",req.user.id);
    const grade = req.params.grade;
    const search = (req.query.search || '').toLowerCase().trim();
    const owner_id  = req.user.id;

    // 1. GET STUDENTS
    let query = supabase
      .from('students')
      .select('*')
      .eq('owner_id', owner_id)
      .eq('grade', grade)
      .order('full_name');

    if (search) query = query.ilike('full_name', `%${search}%`);
    const { data: students } = await query

    // 2. GET ALL MARKS FOR THIS GRADE TO COUNT TESTS
    const { data: marks } = await supabase
      .from('marks')
      .select('student_id') // only need student_id
      .eq('owner_id', owner_id)
      .eq('grade', grade);

    // 3. COUNT HOW MANY TESTS EACH STUDENT HAS - THIS IS THE PART
    const testCounts = {};
    marks?.forEach(m => {
      testCounts[m.student_id] = (testCounts[m.student_id] || 0) + 1;
    });

    // 4. ATTACH COUNT TO EACH STUDENT
    const result = students?.map(s => ({
      id: s.student_number,
      name: s.full_name,
      parent: s.parent_name,
      phone: s.parent_phone,
      dob: s.date_of_birth,
      testsWritten: testCounts[s.student_number] || 0, // matches SID
      registeredAt: s.registered_at
    })) || [];

    res.json({ success: true, students: result, count: result.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.get('/stats/students', authC, async (req,res) => {
  try {
    const {status, grade} = req.query;
    const owner_id = req.user.id;

    console.log("Owner:", owner_id, "Filters:", status, grade)

    // 1. Get school fee amount first
    const { data: feeConfig } = await supabase
      .from("fees_config")
      .select("amount")
      .eq("owner_id", owner_id)
      .single();
    const requiredFee = feeConfig?.amount || 0;

    // 2. Get all students for this owner + filters
    let query = supabase.from('students').select('*').eq('owner_id', owner_id);
    if(status) query = query.eq('status', status); // if you have a status column
    if(grade) query = query.eq('grade', grade);

    const {data: students, error} = await query;
    if(error) return res.status(500).json({success: false, error: error.message})

    // 3. Get all payments for these students to calculate paid/balance
    const studentIds = students.map(s => s.student_number);
    const { data: payments } = await supabase
      .from('fees_payments')
      .select('student_id, amount')
      .eq('owner_id', owner_id)
      .in('student_id', studentIds);

    // 4. Attach paid, balance, status to each student
    const studentsWithFees = students.map(s => {
      const paid = payments
        ?.filter(p => p.student_id === s.student_number)
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const balance = requiredFee - paid;
      const credit = paid - requiredFee;

      let studentStatus = 'no-fee-set';
      if(requiredFee > 0) {
        if(paid === 0) studentStatus = 'unpaid';
        else if(paid < requiredFee) studentStatus = 'partial';
        else if(paid === requiredFee) studentStatus = 'paid';
        else if(paid > requiredFee) studentStatus = 'prepaid';
      }

      return {
        ...s,
        paid,
        required: requiredFee,
        balance: balance > 0 ? balance : 0,
        credit: credit > 0 ? credit : 0,
        status: studentStatus
      }
    })

    // 5. Filter by calculated status if needed
    let filteredStudents = studentsWithFees;
    if(status) filteredStudents = studentsWithFees.filter(s => s.status === status);

    // 6. Recalculate perGrade based on filtered results
    const perGrade = {F1:0, F2:0, F3:0, F4:0};
    filteredStudents.forEach(s => {
      if(perGrade[s.grade] !== undefined) perGrade[s.grade]++;
    })

    res.json({
      success: true,
      students: filteredStudents,
      totalStudents: filteredStudents.length,
      perGrade
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.post('/fees/config/set',authC, express.json(), async (req,res)=>{
  try {
   // console.log("req.user.type",typeof req.user.id);
   //console.log("req.user.value",req.user.id);
    const { amount } = req.body;
    const owner_id = req.user.id;

    if(!amount || amount <= 0) return res.json({ success: false, message: "Enter valid amount" });
    console.log("school fees amount is:",amount);
    const { error } = await supabase
      .from("fees_config")
      .upsert({ owner_id, amount: Number(amount) }, { onConflict: 'owner_id' });

    if (error) return res.status(400).json({ success: false, message: error.message });

    console.log(`School fees updated: $${amount} for all students`);
    res.json({ success: true, schoolFee: Number(amount) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

/*app.post('/fees/config/set', authC, express.json(), async (req,res)=>{
  try {
    const owner_id = req.user.id; // NOT destructured
    const { amount } = req.body;
    if(!amount || amount <= 0) return res.json({ success: false, message: "Invalid amount" });
    console.log("school fees amount is",amount);
    const { error } = await supabase
      .from("fees_config")
      .upsert({ owner_id, amount }, { onConflict: 'owner_id' }); // needs UNIQUE owner_id

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: "School fee updated" });
  } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Server failed" }); }
});
*/
app.get('/fees/config',authC, async (req,res)=>{
  try {
    console.log("req.user.type",typeof req.user.id);
   console.log("req.user.value",req.user.id);
    const { data, error } = await supabase
      .from("fees_config")
      .select("amount")
      .eq("owner_id", req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') return res.json({ success: false, message: error.message }); // PGRST116 = no rows

    res.json({ success: true, schoolFee: data?.amount || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});
app.get('/students/search', authC, async (req,res)=>{
  try {
    const owner_id = req.user.id;
    const q = req.query.q || ''; // ?q=john

    if(q.length < 2) return res.json({ success: true, students: [] });

    const { data: students, error } = await supabase
      .from('students')
      .select('student_number, full_name, grade')
      .eq('owner_id', owner_id)
      .ilike('full_name', `%${q}%`) // search by name
      .limit(8);

    if(error) return res.status(400).json({ success: false, message: error.message });

    res.json({ success: true, students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.post('/fees/pay', authC, express.json(), async (req,res)=>{
  try {
    const { studentId, amount, method } = req.body;
    const owner_id = req.user.id;

    if(!studentId || !amount || amount <= 0) return res.json({ success: false, message: "Invalid data" });

    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('owner_id', owner_id)
      .eq('student_number', studentId)
      .single();

    if(!student) return res.json({ success: false, message: `Student SID ${studentId} not found` });

    const { error } = await supabase.from("fees_payments").insert({
      owner_id,
      student_id: studentId,
      grade: student.grade,
      name: student.full_name,
      amount: Number(amount),
      method: method || "Cash",
      date: new Date().toISOString()
    });

    if (error) return res.status(400).json({ success: false, message: error.message });

    console.log("=".repeat(40));
    console.log(`PAYMENT RECEIVED`);
    console.log(`Student: ${student.full_name} | SID: ${studentId}`);
    console.log(`Grade: ${student.grade} | Amount: $${amount}`);
    console.log("=".repeat(40));

    res.json({ success: true, message: `Payment recorded for ${student.full_name}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});
app.get('/fees/status', authC, async (req,res)=>{
  try {
    const owner_id = req.user.id;

    // 1. Get school fee amount
    const { data: feeConfig } = await supabase
      .from("fees_config")
      .select("amount")
      .eq("owner_id", owner_id)
      .single();
    
    const requiredFee = feeConfig?.amount || 0;

    // 2. Get all students for this owner
    const { data: students } = await supabase
      .from('students')
      .select('student_number, full_name, grade')
      .eq('owner_id', owner_id);

    if(!students || students.length === 0) {
      return res.json({ success: true, students: [], balanceText: "$0 Outstanding" });
    }

    // 3. Get all payments for this owner - ADD || [] HERE
    const { data: payments } = await supabase
      .from('fees_payments')
      .select('student_id, amount')
      .eq('owner_id', owner_id);

    const safePayments = payments || []; // <-- THIS FIXES THE CRASH

    // 4. Calculate status for each student
    const studentsWithStatus = students.map(s => {
      const totalPaid = safePayments // <-- use safePayments
        .filter(p => p.student_id === s.student_number)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      let status, balance, credit;
      
      if (requiredFee === 0) {
        status = 'no-fee-set';
      } else if (totalPaid === 0) {
        status = 'unpaid';
      } else if (totalPaid < requiredFee) {
        status = 'partial';
        balance = requiredFee - totalPaid;
      } else if (totalPaid > requiredFee) {
        status = 'prepaid';
        credit = totalPaid - requiredFee;
      } else {
        status = 'paid';
      }

      return {
        ...s,
        status,
        paid: totalPaid,
        required: requiredFee,
        balance: balance || 0,
        credit: credit || 0
      }
    });

    const totalBalance = studentsWithStatus.reduce((sum, s) => sum + s.balance, 0);
    const balanceText = `$${totalBalance.toFixed(2)} Outstanding`;

    res.json({ 
      success: true, 
      students: studentsWithStatus,
      balanceText 
    });

  } catch (error) {                                             
    console.error(error);
    res.status(500).json({ success: false, message: "Server failed" });
  }
});

app.listen(Port,"0.0.0.0",()=>{
  console.log(`server running on http://0.0.0.0:${Port}`);
})
