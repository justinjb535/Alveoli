import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://pctbcbdqgicazzgwlrhr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Ck_wUGp0GaYOiyri3LC2VQ_VJ4um9uL'
const BASE_URL = "http://10.48.46.64:2000" /*"https://alveoli.onrender.com"*/; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const init = async () => {
  const { data: { session }} = await supabase.auth.getSession();
  
  if(!session) return location.href = 'login.html';

  const owner_id = session.user.id;

  // 1. FETCH SCHOOL DATA FROM YOUR DB
  const schoolRes = await fetch(`${BASE_URL}/school/profile`, {
    headers: { "Authorization": `Bearer ${session.access_token}` }
  });
  const schoolData = await schoolRes.json();

  if(!schoolData.success) {
    console.error("Could not load school profile");
    return;
  }

  const school = schoolData.school; // <-- NOW THIS EXISTS

  // 2. Show user info on dashboard
  document.getElementById('seatBadge').innerText = `Logged in as: ${school.name}`;

  // 3. Load stats
  const res = await fetch(`${BASE_URL}/stats/students`, {
    headers: { "Authorization": `Bearer ${session.access_token}` }
  });
  const data = await res.json();
  console.log("Stats:", data);
}

init();
// Simple logout
window.logoutSchool = async () => {
  await supabase.auth.signOut();
  localStorage.clear(); // clears session
  location.href = 'login.html';
}

console.log('Hello World!');
const ld = document.getElementById("load");
let sdBar   = document.querySelector(".sidebar");
let dBtn    = document.getElementById("Dbtn");      // Dashboard button
let viewStdts = document.getElementById("viewStdts"); // Students button
let regbtn  = document.getElementById("Rbtn");      // Register student button
let mbtn    = document.getElementById("mBtn");      // Marks button
let sBtn    = document.getElementById("sbtn");      // Subjects button
let feesbtn = document.getElementById("fee");       // Fees button
let reportsBtn = document.getElementById("reports");// Reports button
let seatB = document.getElementById("seatBadge")
// Target pages/divs (make sure these exist in your HTML!)
let dash    = document.getElementById("dash");      // Dashboard page div
let reg     = document.getElementById("reg");       // Register page div
let sub     = document.getElementById("sub");       // Subjects page div
let mark   = document.getElementById("markP");     // Marks page div
let sFeesP  = document.getElementById("sFees");     // Fees page div
//let reportsP= document.getElementById("reportsP");  // Reports page div
let warning = document.getElementById("warningSign");       // Main app container
let API = "http://10.48.46.64:2000"/*"https://alveoli.onrender.com";*/
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready, wiring swipe');

//console.log(dash,regbtn);
// Quick debug
//console.log('reg?',!!reg, 'sub?',!!sub, 'mark?',!!mark, 'sFeesP?',!!sFeesP);

// Swipe indicator
const swipeIndicator = document.createElement('div');
swipeIndicator.id = 'swipeIndicator';
swipeIndicator.innerHTML = '↓ Swipe down to exit';
swipeIndicator.style.cssText = `
  position: fixed; top: -50px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.8); color: white; padding: 10px 20px;
  border-radius: 20px; font-size: 14px; transition: top 0.2s;
  z-index: 9999; pointer-events: none;
`;
document.body.appendChild(swipeIndicator);

let startY = 0;
let currentY = 0;
let isSwiping = false;
const SWIPE_THRESHOLD = 100;
let swipeOsc, swipeGain, swipeCtx;

// === AUDIO FUNCTIONS ===
function startSwipeSound(y) {
  if(!swipeCtx) swipeCtx = new (window.AudioContext || window.webkitAudioContext)();
  swipeOsc = swipeCtx.createOscillator();
  swipeGain = swipeCtx.createGain();
  swipeOsc.connect(swipeGain).connect(swipeCtx.destination);
  swipeOsc.type = 'sine';
  swipeGain.gain.setValueAtTime(0.2, swipeCtx.currentTime);
  let freq = 100 + Math.min(y / 80, 1) * 300;
  swipeOsc.frequency.setValueAtTime(freq, swipeCtx.currentTime);
  swipeOsc.start();
}

function updateSwipeSound(currentY) {
  if(!swipeOsc ||!swipeCtx) return;
  let deltaY = currentY - startY;
  let freq = Math.max(200, 600 - deltaY * 2);
  swipeOsc.frequency.setValueAtTime(freq, swipeCtx.currentTime);
}

function stopSwipeSound(success) {
  if(!swipeOsc ||!swipeCtx) return;
  if(success) swipeOsc.frequency.exponentialRampToValueAtTime(150, swipeCtx.currentTime + 0.15);
  else swipeOsc.frequency.setValueAtTime(600, swipeCtx.currentTime);
  swipeGain.gain.exponentialRampToValueAtTime(0.01, swipeCtx.currentTime + 0.15);
  swipeOsc.stop(swipeCtx.currentTime + 0.15);
  swipeOsc = null;
}


document.addEventListener('touchstart', (e) => {
  let ld = document.getElementById("load");
  // Now swipe works on reg, sub, mark, AND fees page
  if((isVisible(reg) || isVisible(sub) || isVisible(mark) || isVisible(sFeesP)) &&!isVisible(ld)) {
    startY = e.touches[0].clientY;
    currentY = startY;
    if(startY < 190) {
      isSwiping = true;
      startSwipeSound(startY);
    }
  }
}, {passive: true});

document.addEventListener('touchmove', (e) => {
  if(!isSwiping) return;
  currentY = e.touches[0].clientY;
  let deltaY = currentY - startY;
  updateSwipeSound(currentY);
  if(deltaY > 0) {
    e.preventDefault();
    swipeIndicator.style.top = Math.min(deltaY/4 - 50, 15) + 'px';
    document.body.style.transform = `translateY(${Math.min(deltaY/3, 80)}px)`;
  }
}, {passive: false});

document.addEventListener('touchend', (e) => {
  if(!isSwiping) return;
  isSwiping = false;
  let deltaY = currentY - startY;
  let success = deltaY > SWIPE_THRESHOLD;
  swipeIndicator.style.top = '-50px';
  document.body.style.transform = 'translateY(0)';
  stopSwipeSound(success);
if(success) goToMain();
});

function isVisible(el) {
  return el && window.getComputedStyle(el).display!== 'none';
}

// === CLICK HANDLERS ===
if(dBtn) dBtn.onclick = () => {
  seatB.style.display = "none";
  sdBar.style.display = "none";
  dash.style.display = "block";
  //warning.style.display = "none";
}

if(regbtn) regbtn.onclick = () => {
  seatB.style.display = "none";
  sdBar.style.display = "none";
  reg.style.display = "block";
 // warning.style.display = "none";
}

if(sBtn) sBtn.onclick = () => {
  seatB.style.display = "none";
  sdBar.style.display = "none";
  sub.style.display = "block";
  //warning.style.display = "none";
}

if(mbtn) mbtn.onclick = () => {
  seatB.style.display = "none";
  sdBar.style.display = "none";
  markP.style.display = "block";
  //warning.style.display = "none";
}

// FIXED: feesbtn opens fees page
if(feesbtn) feesbtn.onclick = (e) => {
  e.preventDefault();
  let savedPin = localStorage.getItem("feesPin")
  
  if(!savedPin){
    let newPin = prompt("Create pin");
    if(!newPin) return;
  
  if(newPin.length < 4){
    alert("PIN Should be at least 4 characters long")
    return;
  }
  localStorage.setItem("feesPin",newPin);
  alert("Pin created");
  savedPin = newPin;
  }
  let enteredPin = prompt("Enter your Pin");
  
  if(enteredPin === savedPin){
  sdBar.style.display = "none";
  sFeesP.style.display = "block"; // show fees page
  //warning.style.display = "none";
  }else if(!enteredPin){
    alert("Nothing was entered please try again")
  }else{
    alert("incorrect pin");
  }
}

// Back button in sidebar
/*if(exit) exit.onclick = () => {
  exitPage();
}
*/

const actionBtn = document.getElementById('action');

//const reg = document.getElementById("reg");
const gradeSelect = document.getElementById('grade');
const streamSelect = document.getElementById('classStream');

  // 1. Load count when page opens
  updateDashboard();

actionBtn.addEventListener('click', async (e) => {
  ld.style.display = "block";
  reg.style.display = "none";
  actionBtn.disabled = true;

  const startTime = Date.now(); // start timer FIRST
  
  try {
    const newStudentId = await getSId(); // only 1 call
    
    // Wait until 6sec total passed
    const elapsed = Date.now() - startTime;
    const minTime = 6000;
    if(elapsed < minTime) {
      await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
    }

    if(newStudentId){
      reg.style.display = "block";
      alert(`Success! Registered: ${newStudentId}`);
      navigator.clipboard.writeText(newStudentId);

      document.querySelectorAll("#reg input, #reg select").forEach(input => {
        if(input.id !== 'studentNumber') input.value = "";
      });
      updateDashboard();
    } else {
      reg.style.display = "block";
    }
    
  } catch (error) {
    alert("Error: " + error.message);
    reg.style.display = "block";
  } finally {
    ld.style.display = "none"; // hide loader LAST
    actionBtn.disabled = false;
  }
});

let token = null;
let currentSubject = null;
let currentGrade = null;

// HELPER: gets fresh token every time
async function getToken() {
  const { data: { session }} = await supabase.auth.getSession();
  if(!session) {
    window.location.href = 'login.html'; // kick if no token
    throw new Error("No session");
  }
  return session.access_token;
}

// 1. INIT
async function init() {
  token = await getToken(); // set token once on load
  loadSubjects();
}
init();

async function loadSubjects() {
  try {
    const token = await getToken();
    const res = await fetch(`${API}/subjects`, {
      headers:{ "Authorization" : `Bearer ${token}` }
    });
    const data = await res.json();
    console.log("Subjects response:", data);
    
    if(!data.subjects || data.subjects.length === 0){
      document.getElementById('subjectSelectList').innerHTML = 
        `<div style="padding:20px; text-align:center; color:#888;">
          No subjects yet 😅<br>
          <button onclick="addSubject()" style="margin-top:10px;">+ Add First Subject</button>
        </div>`;
      return;
    }

    document.getElementById('subjectSelectList').innerHTML = 
      data.subjects?.map(s => `<div class="subject" onclick="selectSubject('${s}')">${s}</div>`).join('');
  } catch(e) {
    console.error("loadSubjects error:", e);
    alert("Failed to load subjects: " + e.message);
  }
}

async function addSubject() {
  const subjectEl = document.getElementById("subjectInput");
  if (!subjectEl) return alert("Subject input not found");

  const subject = subjectEl.value.trim();
  if (!subject) return alert("Please enter a subject name");

  const token = await getToken();

  const res = await fetch(`${API}/subjects/add`, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ subject }) // ✅ single string
  });

  const data = await res.json();
  alert(data.message || data.error || JSON.stringify(data));
  console.log("Sending:", { subject });

  if (data.success) loadSubjects();
}
window.addSubject = addSubject;

// 4. WHEN YOU CLICK A SUBJECT
function selectSubject(sub) {
  currentSubject = sub;
  document.getElementById('sctdSub').innerText = `Subject: ${sub}`;
  document.getElementById('subSele').style.display = "none";
  document.getElementById('testInfo').style.display = "block";
}
window.selectSubject = selectSubject;

// 5. LOAD STUDENTS WHEN CLICK "Load Students"
document.getElementById('assign').addEventListener('click', async () => {
  currentGrade = document.getElementById('gradeSelect').value;
  const term = document.getElementById('termSelect').value;
  const paperNo = document.getElementById('paperNo').value;
  const total = document.getElementById('totalMarks').value;
  
  if(!currentSubject || !currentGrade || !term || !total) return alert("Fill all fields first");
  
  const token = await getToken();
  const res = await fetch(`${API}/students/grade/${currentGrade}`, {
    headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_KEY, 
        "Authorization" : `Bearer ${token}`}
  });
  const data = await res.json();
  
  document.getElementById('marks').style.display = "block";
  const tbody = document.getElementById('marksTableBody');
  tbody.innerHTML = "";
  
  data.students?.forEach(s => {
    tbody.innerHTML += `
      <tr>
        <td>${s.name}</td>
        <td><input type="number" class="mark-input" data-id="${s.id}" placeholder="0/${total}"></td>
      </tr>
    `
  })
});

// 6. SAVE MARKS
document.getElementById('saveMarksBtn').addEventListener('click', async () => {
  const term = document.getElementById('termSelect').value;
  const paperNo = document.getElementById('paperNo').value.trim().toUpperCase();
  const total = Number(document.getElementById('totalMarks').value);
  const token = await getToken();

  const marks = [];
  document.querySelectorAll('.mark-input').forEach(input => {
    const mark = Number(input.value);
    if(!isNaN(mark) && mark >= 0){
      marks.push({ studentId: input.dataset.id, mark: mark });
    }
  });

  if(marks.length === 0) return alert('Enter at least 1 mark');

  const res = await fetch(`${API}/marks/save`, {
    method: 'POST',
    headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_KEY, 
        "Authorization" : `Bearer ${token}`},
    body: JSON.stringify({ grade: currentGrade, subject: currentSubject, term, paperNo, total, marks })
  });

  const data = await res.json();
  if(data.success){
    alert(`Saved ${marks.length} marks for ${currentSubject}`);
    goToMain();
  } else {
    alert('Save failed: ' + data.message);
  }
});

// 7. LOAD STUDENTS LIST WITH TEST COUNT
async function loadStudentsList(){
  const grade = gradeFilter.value;
  const search = searchInput.value.trim();
  if(!grade) return;
  const token = await getToken();

  const tbody = document.getElementById('studentsTableBody');
  tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';

  const res = await fetch(`${API}/students/list/${grade}?search=${encodeURIComponent(search)}`,{
    headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_KEY, 
        "Authorization" : `Bearer ${token}`}
  });
  const data = await res.json();

  tbody.innerHTML = data.students?.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.name}</td>
      <td>${s.parent}</td>
      <td>${s.phone}</td>
      <td>${s.dob}</td>
      <td>${s.testsWritten} Tests</td>
    </tr>
  `).join('') || `<tr><td colspan="6">No students found</td></tr>`;
}
gradeFilter.addEventListener('change', loadStudentsList);

// 8. EXIT BUTTON
function goToMain(){
  document.querySelectorAll('#dash, #reg, #sub, #markP, #sFees, #studentsPage, #testInfo, #marks').forEach(el => {
    if(el) el.style.display = 'none';
  });
  document.getElementById('subSele').style.display = 'block';
  document.getElementById('testInfo').style.display = 'none';
  document.querySelector(".sidebar").style.display = 'block'; 
  //document.getElementById('app').style.display = 'block';
  
  currentSubject = null;
  currentGrade = null;
}
document.querySelectorAll(".exit").forEach(btn => { btn.onclick = goToMain; });

let nameSearchEl = document.getElementById("studentNameSearch");
let searchResultsEl = document.getElementById("searchResults");
let studentIdEl = document.getElementById("studentIdInput"); // hidden SID
let reco = document.getElementById("record");
let amountEl = document.getElementById("amount");
let methodEl = document.getElementById("method");
let balanceEl = document.querySelectorAll(".balance");

let setSchoolFeeBtn = document.getElementById("setSchoolFeeBtn");
let schoolFeeAmountEl = document.getElementById("schoolFeeAmount");
let currentSchoolFeeEl = document.getElementById("currentSchoolFee");
let feeStatusListEl = document.getElementById("feeStatusList");

let searchTimeout;

async function loadSchoolFee(){
  const {data:{session}} = await supabase.auth.getSession();
  if(!session) return;
  const res = await fetch(`${API}/fees/config`,{
    headers:{
        "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`}
  });
  const data = await res.json();
  currentSchoolFeeEl.textContent = `$${data.schoolFee}`;
  schoolFeeAmountEl.value = data.schoolFee;
}
// 2. Head saves new amount
setSchoolFeeBtn.addEventListener('click', async () => {
  console.log("click fees setting ")
  let amount = Number(schoolFeeAmountEl.value);
  if(isNaN(amount) || amount <= 0){
    alert("Enter valid amount");
    return;
  }
const {data:{session}}= await supabase.auth.getSession();
if(!session) return;
  const res = await fetch(`${API}/fees/config/set`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`},
    body: JSON.stringify({amount})
  });

  const data = await res.json();
  if(data.success){
    alert(`School fees set to $${amount} for all students`);
    loadSchoolFee();
    loadFeeStatus();
  }
});

nameSearchEl.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  let query = nameSearchEl.value.trim();
  
  if(query.length < 2){
    searchResultsEl.style.display = 'none';
    studentIdEl.value = ""; 
    return;
  }
    
  searchTimeout = setTimeout(async () => {
    const {data:{session}} = await supabase.auth.getSession();
    if(!session) return;

    // FIX 2: Use ?q= not /search/
    const res = await fetch(`${API}/students/search?q=${encodeURIComponent(query)}`,{
      headers: {
          "apikey":SUPABASE_KEY, 
          "Authorization" : `Bearer ${session.access_token}`
      }
    });
    const data = await res.json();
    
    if(!data.students || data.students.length === 0){
      searchResultsEl.innerHTML = '<div style="padding:10px; color:#9ca3af">No student found</div>';
    } else {
      // FIX 3: Use backend keys: student_number, full_name, grade
      searchResultsEl.innerHTML = data.students.map(s => `
        <div class="search-item" 
             data-id="${s.student_number}" 
             data-name="${s.full_name}"
             style="padding:10px; cursor:pointer; border-bottom:1px solid #374151">
          <strong style="color:white">${s.full_name}</strong> - Grade ${s.grade}<br>
          <small style="color:#9ca3af">SID: ${s.student_number}</small>
        </div>
      `).join('');
      
      // Click to select
      searchResultsEl.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          studentIdEl.value = item.dataset.id; // save SID secretly
          nameSearchEl.value = item.dataset.name; // show name
          searchResultsEl.style.display = 'none';
        });
        
        item.onmouseover = () => item.style.background = '#374151';
        item.onmouseout = () => item.style.background = 'transparent';
      });
    }
    
    searchResultsEl.style.display = 'block';
  }, 300);
});

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
  if(!nameSearchEl.contains(e.target) && !searchResultsEl.contains(e.target)){
    searchResultsEl.style.display = 'none';
  }
});
// 4. Load all students fee status
async function loadFeeStatus(){
  const {data:{session}} = await supabase.auth.getSession();
  
  if(!session) return;
  const res = await fetch(`${API}/fees/status`,{
  headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`}
  });
  const data = await res.json();

balanceEl.forEach(el => {
    el.textContent = data.balanceText;
});

const students = (data.students || []);
const filterBtns = document.querySelectorAll(".filter-btn");
function showEmpty(){
feeStatusListEl.innerHTML = `<p style="color:#666">Select any button at the top</p>`;
}
showEmpty();
function renderList(statusFilter, gradeFilter) {
  const filter = students
    .filter(s => (!statusFilter || s.status === statusFilter))
    .filter(s => (!gradeFilter || s.grade === gradeFilter))
    
     if(filter.length === 0) {
    feeStatusListEl.innerHTML = `<p style="color:#666">No students found</p>`;
    return;
  }
    
    feeStatusListEl.innerHTML = filter.map(s => {
      let color, badge;
      if (s.status === 'no-fee-set') {
        color = "black"; badge = "SET FEE FIRST ⚠️";
      } else if (s.status === 'unpaid') {
        color = "black"; badge = `UNPAID $${s.paid}/$${s.required}`;
      } else if (s.status === 'partial') {
        color = "#777"; badge = `PARTIAL $${s.paid}/$${s.required} | Owing: $${s.balance}`;
      } else if (s.status === 'prepaid') {
        color = "black"; badge = `PREPAID $${s.paid}/$${s.required} | Credit: $${s.credit}`;
      } else {
        color = "#111"; badge = `PAID $${s.paid}/$${s.required}`;
      }

      return `
        <div style="border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:8px; background:#fff">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <div>
              <div style="font-weight:600; font-size:15px; color:black;">${s.full_name}</div>
              <div style="font-size:12px; color:#444;">Grade ${s.grade} • SID: ${s.student_number}</div>
            </div>
            <div style="color:${color}; font-weight:600; font-size:13px; text-align:right">
              ${badge}
            </div>
          </div>
        </div>
      `;
    }).join('');
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const status = btn.dataset.status;
  
    renderList(status);
  });
});
}
// 5. Record payment
reco.addEventListener('click', async () => {
  let studentId = studentIdEl.value.trim(); // SID from hidden input
  let amount = Number(amountEl.value);
  let method = methodEl.value;

  if (!studentId) {
    alert("Select student from dropdown first!");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert("Enter valid amount");
    return;
  }
  const {data:{session}} = await supabase.auth.getSession();
  
  if(!session) return;
  const res = await fetch(`${API}/fees/pay`, {
    method: 'POST',
    headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`},
    body: JSON.stringify({studentId, amount, method})
  });

  const data = await res.json();
  alert(data.message);

  if(data.success){
    nameSearchEl.value = ""; // clear name
    studentIdEl.value = ""; // clear SID
    amountEl.value = "";
    loadFeeStatus(); // refresh list + total
  }
});

// 6. Call on page load
loadSchoolFee();
loadFeeStatus();
  // 6. MOVED INSIDE: loadStreams function
  
  // 7. MOVED INSIDE: getSId function
  async function getSId() {
  const {data: {session}} = await supabase.auth.getSession();
    const stNm = document.getElementById('stNm').value.trim();
    const grade = gradeSelect.value;
   // const classStream = streamSelect.value;
    const pNm = document.getElementById('pNm').value.trim();
    const pP = document.getElementById('pP').value.trim();
    const dob = document.getElementById('dob').value.trim();
    
    if(!stNm || !grade || !pNm || !pP || !dob){
      alert('Enter all input fields');
      return null;
    }
    
    try {
        const {data:{session}} = await supabase.auth.getSession();
  
  if(!session) return;
      const res = await fetch(`${API}/generate/studentNumber`, {
        method: 'POST',
        headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}` },
        body: JSON.stringify({ 
          universalCode: "SID",
          stNm,
          grade,
          dob,
          pNm,
          pP 
        })
      });
      
      const data = await res.json();
      if(!data.success){
        alert(data.message);
        return null;
      }
      return data.studentNo;
    } catch (error) {
  console.error("Skyie tech failed:", error.message, error.stack); // <- add .message
  alert("Error: " + error.message); // <- so you see it in the popup too
  return `TEMP${Date.now().toString().slice(-5)}`;
}
  }

  // 8. MOVED INSIDE: updateDashboard function
  async function updateDashboard(){
    const {data:{session}} = await supabase.auth.getSession();
    if(!session) return;
    try {
        const {data:{session}} = await supabase.auth.getSession();
  
  if(!session) return;
      const res = await fetch(`${API}/stats/students`,{
      headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`}
      });
      const data = await res.json();
      
      if(data.success){
        document.getElementById('nOfStudents').textContent = data.totalStudents;
        document.getElementById('f1Count').textContent = data.perGrade.F1 || 0;
        document.getElementById('f2Count').textContent = data.perGrade.F2 || 0;
        document.getElementById('f3Count').textContent = data.perGrade.F3 || 0;
        document.getElementById('f4Count').textContent = data.perGrade.F4 || 0;
      }
    } catch (error) {
      console.error("Dashboard failed:", error);
    }
  }

});

let reports = document.getElementById("reports");

reports.onclick = () =>{
  alert("'reports' coming soon");
}

  // 2. Load students by grade
  const assignBtn = document.getElementById('assign');
  if(assignBtn) {
    assignBtn.addEventListener('click', loadStudents);
  }


const viewBtn = document.getElementById('viewStdts');
const studentsPage = document.getElementById('studentsPage');
const gradeFilter = document.getElementById('gradeFilter');
const searchInput = document.getElementById('searchStudent');
const searchBtn = document.getElementById('searchBtn');

viewBtn.addEventListener('click', () => {
  studentsPage.style.display = 'block';
  document.getElementById('sub').style.display = 'none';
  document.getElementById('markP').style.display = 'none';
    sdBar.style.display = "none";
    //exit.style.display="block"
});


async function loadStudents(){
  const grade = gradeFilter.value;
  const search = searchInput.value.trim();

  if(!grade) {
    alert('Select grade first');
    return;
  }

  const tbody = document.getElementById('studentsTableBody');
  tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';

  try {
      const {data:{session}} = await supabase.auth.getSession();
  
  if(!session) return;
    // NEW route + NO subject/term needed
    const res = await fetch(`${API}/students/list/${grade}?search=${encodeURIComponent(search)}`,{
      headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`}
      
    });
    const data = await res.json();

    if(!data.success || data.students.length === 0){
      tbody.innerHTML = `<tr><td colspan="6">No students found in ${grade}</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    data.students.forEach(s => {
      tbody.innerHTML += `
        <tr>
          <td>${s.id}</td>
          <td>${s.name}</td>
          <td>${s.parent}</td>
          <td>${s.phone}</td>
          <td>${s.dob}</td>
          <td>${s.testsWritten}</td>
        </tr>
      `;
    });
  } catch(err) {
    console.error("Load students failed:", err);
    tbody.innerHTML = '<tr><td colspan="6">Server error</td></tr>';
  }
}

gradeFilter.addEventListener('change', loadStudents);
searchInput.addEventListener('input', () => {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(loadStudents, 300); // live search, no button needed
});

document.getElementById('saveMarksBtn').addEventListener('click', async () => {
  const term = document.getElementById('termSelect').value; // make sure you have this
  const paperNo = document.getElementById('paperNo').value.trim().toUpperCase();
  const total = Number(document.getElementById('totalMarks').value);
  
  if(!currentSubject || !currentGrade || !term || !total){
    alert('Select subject, grade, term + enter total marks first');
    return;
  }

  // Collect all marks from inputs
  const marks = [];
  document.querySelectorAll('.mark-input').forEach(input => {
    const mark = Number(input.value);
    if(!isNaN(mark) && mark >= 0){
      marks.push({
        studentId: input.dataset.id,
        mark: mark
      });
    }
  });

  if(marks.length === 0){
    alert('Enter at least 1 mark');
    return;
  }

  ld.style.display = "block"; // show your masterpiece loader 6sec

  try {
      const {data:{session}} = await supabase.auth.getSession();
  
  if(!session) return;
    const res = await fetch(`${API}/marks/save`, {
      method: 'POST',
      headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`},
      body: JSON.stringify({
        grade: currentGrade,
        subject: currentSubject,
        term: term,
        paperNo: paperNo,
        total: total,
        marks: marks
      })
    });

    const data = await res.json();
    if(data.success){
      alert(`Saved ${marks.length} marks for ${currentSubject}`);
      goToMain(); // back to sidebar
    } else {
      alert('Save failed: ' + data.message);
    }
  } catch(err) {
    console.error("Save marks failed:", err);
    alert("Can't reach server. Check WiFi");
  } finally {
    ld.style.display = "none";
  }
});

function goToMain(){
  // 1. Hide all pages
  document.querySelectorAll('#dash, #reg, #sub, #markP, #sFees, #studentsPage, #testInfo, #marks').forEach(el => {
    if(el) el.style.display = 'none';
  });
  
  // 2. Reset marks flow to step 1
  if(document.getElementById('subSele')) document.getElementById('subSele').style.display = 'block';
  if(document.getElementById('testInfo')) document.getElementById('testInfo').style.display = 'none';
  
  // 3. Show sidebar + main wrapper
  const sdBar = document.querySelector(".sidebar"); // get it fresh, don't rely on global var
  const app = document.getElementById('app');
  
  if(sdBar) sdBar.style.display = 'block'; 
  if(app) app.style.display = 'block';
  
  console.log('Exited to main');
}

// Attach exit buttons AFTER DOM loads - do this ONCE only
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(".exit").forEach(btn => {
    btn.onclick = goToMain;
  });
});
  const ellp = document.getElementById('ellpsis');
  const pP = document.getElementById("popP");
  
  ellp.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevent immediate close
  pP.classList.remove("remove");
  pP.classList.add("add");
});

// Hide popup when clicking outside
document.addEventListener('click', () => {
  if (pP.classList.contains("add")) {
   // pP.classList.remove("add");
    pP.classList.add("remove");

    // Hide element after animation ends
/*    pP.addEventListener("animationend", () => {
      pP.style.display = "none";
      pP.classList.remove("remove");
    }, { once: true });*/
  }
});

// Optional: Prevent closing when clicking inside popup
pP.addEventListener('click', (e) => {
  e.stopPropagation();
});

async function loadDashboardStats(){
  console.log("loaded")
  const {data:{session}} = await supabase.auth.getSession();
  if(!session) return;

  const res = await fetch(`${API}/dashboard-stats`,{
   headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`}
  });
  const data = await res.json();
  if(!data.success) return; // FIX HERE

  const balanceEl = document.getElementById('balance'); // the one under "Fees Collected"
  if(balanceEl) balanceEl.textContent = `$${data.fees_collected.toFixed(2)} Collected`;

  // Teachers + Device Limit: 0 / 10 | Device limit: 12
  document.getElementById('teacherCount').textContent =
    `${data.actual_teachers} / ${data.expected_teachers}`;
  document.getElementById('deviceLimit').textContent =
    `Device limit : ${data.device_limit}`;
}

// Call on load
loadDashboardStats();

async function loadPassRate() {
  const res = await fetch(`${API}/dashboard/passrate?grade=12&term=Term1`,{
    headers: {
          "Content-Type":"application/json",
          "apikey":SUPABASE_KEY, "Authorization" : `Bearer ${session.access_token}`}
  });
  const data = await res.json();
  if(data.success){
    document.getElementById('passRate').innerText = data.passRate + '%';
    //document.getElementById('passRateSub').innerText = `${data.passed} of ${data.total} students`;
    console.log('passrate',data.passRate);
  }
}

history.pushState(null, null, location.href);
window.onpopstate = function () {
    history.go(1); // forces it to stay. Or use navigator.app.exitApp() for Capacitor
};
