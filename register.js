import express from "express";
import { supabaseAdmin } from "./supabase.js";
const router = express.Router();

const PLAN_BASE = {
  "monthly": { name: "1 Month", months: 1, small_price: 800, big_price: 1500 },
  "quarterly": { name: "3 Months", months: 3, small_price: 2500, big_price: 4200 },
  "yearly": { name: "1 Year", months: 12, small_price: 9800, big_price: 12600 }
};

const isEmail = (s) => /^\S+@\S+\.\S+$/.test(s);
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0? n : def;
};

router.post("/", async (req, res) => {
  const { email, password, name, teacherCount, studentCount, address, plan } = req.body;

  // 1. VALIDATE
  const errors = {};
  if (!email ||!isEmail(email)) errors.email = "Enter a valid school email";
  if (!password || password.length < 8) errors.password = "Password must be 8+ characters";
  if (!name || String(name).trim().length < 2) errors.name = "School name is required";
  if (!address || String(address).trim().length < 3) errors.address = "School address is required";
  if (!plan ||!PLAN_BASE[plan]) errors.plan = "Select a valid plan"; // FIX 1

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const student_count = toInt(studentCount, 0);
  const base = PLAN_BASE[plan]; // FIX 2
  const isBigSchool = student_count >= 220;
  const price_cents = isBigSchool? base.big_price : base.small_price;

  try {
    // 2. CREATE AUTH USER
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true,
      user_metadata: { school_name: String(name).trim() }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return res.status(409).json({ error: "Email already registered. Please login instead." });
      }
      throw authError;
    }

    const user_id = authData.user.id;

    // 3. CREATE SCHOOL ROW
    const { data: schoolData, error: schoolError } = await supabaseAdmin.from('schools').insert({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      address: String(address).trim(),
      teacher_count: toInt(teacherCount, 0),
      student_count: student_count,
      plan_name: `${base.name} - $${(price_cents/100).toFixed(2)}`,
      plan_months: base.months,
      plan_price_cents: price_cents,
      seat_limit: toInt(teacherCount, 0) + 2,
      owner_id: user_id // Good, we use owner_id
    }).select().single();

    if (schoolError) {
      console.error("SCHOOL INSERT ERROR:", schoolError)
      // If school fails, delete the auth user so we don't have ghost accounts
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      throw schoolError;
    }

    return res.json({
      status: "ok",
      message: "School registered successfully",
      school_id: schoolData.id
    });

  } catch (err) {
    console.error("Register crash:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
