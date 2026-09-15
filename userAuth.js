import express from "express";
import { supabaseAdmin } from "./supabase.js";
const router = express.Router();

const isEmail = (s) => /^\S+@\S+\.\S+$/.test(s);

router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  // 1. VALIDATE
  if (!email || !isEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be 8+ characters" });
  }

  try {
    // 2. CREATE AUTH USER
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return res.status(409).json({ error: "Email already registered. Please login instead." });
      }
      throw authError;
    }

    const user_id = authData.user.id;

    // 3. CREATE USER ROW
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: user_id,
      email: String(email).trim().toLowerCase()
    });

    if (dbError) {
      // cleanup ghost auth user
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      throw dbError;
    }

    return res.json({
      status: "ok",
      message: "User registered successfully",
      user_id: user_id
    });

  } catch (err) {
    console.error("User signup crash:", err);
    return res.status(500).json({ error: err.message });
  }
});

// BONUS: login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: String(password)
  });
  if (error) return res.status(401).json({ error: error.message });
  return res.json({ status: "ok", session: data.session });
});

export default router;
