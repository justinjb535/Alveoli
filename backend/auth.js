
import { supabaseAdmin } from "./supabase.js"; // <-- THIS WAS MISSING

export const authC = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if(!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token); // use admin to verify any token

    if(error ||!user) {
      return res.status(401).json({ success: false, message: "Authentication failed" });
    }

    req.user = user; // attach user to request so routes can use req.user.id
    next();
  } catch (err) {
    console.error("authC error:", err);
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }
}

