import express from "express";
import { supabaseAdmin } from "./supabase.js";
import { authC } from "./auth.js"; // must be head only

const router = express.Router();

// POST /api/teachers/invite
router.post("/invite", authC, async (req, res) => {
  const { email, password, name } = req.body;
  const headId = req.user.id;

  // 1. Get head's school_id
  const { data: school } = await supabase.from("schools").select("id").eq("owner_id", headId).single();
  if(!school) return res.status(403).json({error: "No school"});

  // 2. Create Auth user for teacher
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if(authError) return res.status(400).json({error: authError.message});

  // 3. Create teachers row linked to school
  const { data: teacher, error: tError } = await supabase.from("teachers")
    .insert({ 
      auth_id: authData.user.id, 
      school_id: school.id, 
      name, 
      email,
      role: 'teacher' 
    })
    .select().single();
  if(tError) return res.status(400).json({error: tError.message});

  res.json({ message: `Teacher ${name} created. Login: ${email}`, teacher });
});

export default router;
