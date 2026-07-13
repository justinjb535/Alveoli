import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authC } from "../lib/auth.js"; // verifies the JWT token

const router = express.Router();

// GET /me 
router.get("/me", authC, async (req, res) => {
  const userId = req.user.id; // from authC after verifying token

  // 1. Check if user is a Head
  const { data: school } = await supabase
    .from("schools")
    .select("*")
    .eq("owner_id", userId)
    .single();

  if (school) {
    return res.json({ role: 'head', school }); // -> dashboard.html uses this
  }

  // 2. Check if user is a Teacher
  const { data: teacher } = await supabase
    .from("teachers")
    .select("*, schools:school_id(*)") // join school data too
    .eq("auth_id", userId)
    .single();

  if (teacher) {
    return res.json({ role: 'teacher', school: teacher.schools, teacher });
  }

  // 3. Google login but no school yet
  return res.status(404).json({ error: "No school found. Complete setup." });
});

export default router;
