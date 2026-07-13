import crypto from "crypto";
export function hash(password){
  return crypto.createHash('sha256').update(password).digest('hex');
}
