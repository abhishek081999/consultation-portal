/**
 * generate-data.js
 * Reads the XLSX file and writes data.js which the browser loads directly.
 * Run: node generate-data.js
 */

const XLSX = require('xlsx');
const fs   = require('fs');

const FILE = 'Makar Sankranti Special  (Responses) (1).xlsx';
const wb   = XLSX.readFile(FILE, { raw: false, cellDates: false });

// ── helpers ──────────────────────────────────────────────────────────────────
function cleanStr(v) {
    return v === undefined || v === null ? '' : String(v).trim();
}

// Convert Excel serial date → "DD/MM/YYYY"
function excelDateStr(v) {
    if (!v && v !== 0) return '';
    if (typeof v === 'string') {
        // Already a date string like "17/08/1997" or "1/13/2026 18:44:26"
        // strip the time part if present
        return v.split(' ')[0];
    }
    if (typeof v === 'number') {
        // Excel serial → JS date
        const d = new Date((v - 25569) * 86400 * 1000);
        const dd = String(d.getUTCDate()).padStart(2,'0');
        const mm = String(d.getUTCMonth()+1).padStart(2,'0');
        const yyyy = d.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    return cleanStr(v);
}

// Convert Excel serial time fraction → "HH:MM"
function excelTimeStr(v) {
    if (!v && v !== 0) return '';
    if (typeof v === 'string') {
        // Already "18:05:00" or "10:45 AM" etc
        return v.substring(0, 5);
    }
    if (typeof v === 'number') {
        const totalSecs = Math.round(v * 86400);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    return cleanStr(v);
}

// ── Sheet: Assignee (Makar Sankranti processed data) ─────────────────────────
// Columns: Column 1, Name(=phone), Number(=clientName), Gender, DOB, Time,
//          Place, Query(=package), Query 2(=concern), Conslutant assigned(=detail),
//          Consulatant(=primary), Consulatnt foundation, Status, First Prefencesence
const assigneeSheet = wb.Sheets['Assignee'];
const assigneeRaw   = XLSX.utils.sheet_to_json(assigneeSheet, { defval: '' });

const makarResponses = assigneeRaw
    .filter(r => cleanStr(r['Number']) || cleanStr(r['Name']))  // skip blank rows
    .map((r, i) => ({
        id:          'Mak-' + cleanStr(r['Column 1'] || (i + 1)),
        Campaign:    'Makar Sankranti',
        rowNum:      cleanStr(r['Column 1'] || (i + 1)),
        clientName:  cleanStr(r['Number']),                         // Number col = client name
        phone:       cleanStr(r['Name']),                           // Name col   = phone number
        gender:      cleanStr(r['Gender']),
        dob:         excelDateStr(r['DOB']),
        time:        excelTimeStr(r['Time']),
        place:       cleanStr(r['Place']),
        package:     cleanStr(r['Query']),
        concern:     cleanStr(r['Query 2']),
        queryDetail: cleanStr(r['Conslutant assigned ']),
        consultant:  cleanStr(r['Consulatant']),
        foundation:  cleanStr(r['Consulatnt foundation']),
        status:      cleanStr(r['Status']) || 'Pending',
        firstPref:   cleanStr(r['First Prefencesence']),
    }))
    .filter(r => r.clientName);   // must have a client name

console.log(`Makar Sankranti (Assignee): ${makarResponses.length} rows`);

// ── Sheet: Assignee of Hanuman ────────────────────────────────────────────────
// This sheet is a raw copy of the Hanuman form responses without proper headers.
// Use the Hanuman Jayanti sheet directly (raw form data) and merge with Assignee of Hanuman for status.
const hanumanSheet = wb.Sheets['Hanuman Jayanti'];
const hanumanRaw   = XLSX.utils.sheet_to_json(hanumanSheet, { defval: '', raw: false });

// Assignee of Hanuman has bad headers (first data row became header).
// Re-read with header:1 to get arrays, then map manually.
const hanAssigneeSheet = wb.Sheets['Assignee of Hanuman'];
const hanAssigneeArr   = XLSX.utils.sheet_to_json(hanAssigneeSheet, { defval: '', header: 1 });
// Row 0 is the first data row (Datta Matre). The COLUMNS are:
// [0]=rowNum? [1]=DOB-serial [2]=Phone [3]=Name [4]=Gender [5]=Time [6]=Place [7]=Package [8]=Concern [9]=QueryDetail
// But first row of data (index 0) is the raw first Hanuman entry.
// We'll just use the Hanuman Jayanti raw form sheet + mark them all Pending for now
// (Assignee of Hanuman doesn't seem to have status/consultant columns reliably)

const hanumanResponses = hanumanRaw.map((r, i) => ({
    id:          'Han-' + (i + 1),
    Campaign:    'Hanuman Jayanti',
    rowNum:      String(i + 1),
    clientName:  cleanStr(r['Your Name']),
    phone:       cleanStr(r['Contact Number (Whatsapp )']),
    gender:      cleanStr(r['Gender']),
    dob:         cleanStr(r['Your Date of Birth']),
    time:        cleanStr(r['Time of Born ']).substring(0, 5),
    place:       cleanStr(r['Place you Born']),
    package:     cleanStr(r['Column 9']),
    concern:     cleanStr(r['Select and Write Your concern which is selected ']),
    queryDetail: cleanStr(r['Write detail of consult Query ']),
    consultant:  '',
    foundation:  '',
    status:      cleanStr(r['  Response Confirmation ']) ? 'Pending' : 'Pending',
    firstPref:   '',
    email:       cleanStr(r['Email address']),
    clientType:  cleanStr(r['Are you new to our services or have you used our services before?']),
    heardVia:    cleanStr(r['How did you hear about us?']),
    payment:     cleanStr(r['Payment Method']),
    screenshot:  cleanStr(r['Upload your payment screenshot (Mandatory for confirmation). Without this, your consultation cannot be scheduled.']),
})).filter(r => r.clientName);

console.log(`Hanuman Jayanti: ${hanumanResponses.length} rows`);

// Add email/payment etc. to Makar rows (they don't have it in Assignee sheet,
// so pull from original Makar form sheet)
const makarFormSheet = wb.Sheets['Makar Sankranti Special (Respon'];
const makarFormRaw   = XLSX.utils.sheet_to_json(makarFormSheet, { defval: '', raw: false });

// Build a quick lookup by row index
makarResponses.forEach((row, i) => {
    const form = makarFormRaw[i] || {};
    row.email      = cleanStr(form['Email address']);
    row.clientType = cleanStr(form['Are you new to our services or have you used our services before?']);
    row.heardVia   = cleanStr(form['How did you hear about us?']);
    row.payment    = cleanStr(form['Payment Method']);
    row.screenshot = cleanStr(form['Upload your payment screenshot (Mandatory for confirmation). Without this, your consultation cannot be scheduled.']);
});

// ── Combine all responses ─────────────────────────────────────────────────────
const allResponses = [...hanumanResponses, ...makarResponses];
console.log(`Total responses: ${allResponses.length}`);

// ── Sheet: Consultant_List ────────────────────────────────────────────────────
const consultantSheet = wb.Sheets['Consultant_List'];
const consultantArr   = XLSX.utils.sheet_to_json(consultantSheet, { defval: '', header: 1 });

// Row 0 is empty, Row 1 is header ["Batch","Participants","Contat detail"]
// Data starts at Row 2
const consultants = consultantArr
    .slice(2)
    .filter(row => cleanStr(row[1]))   // must have a name
    .map(row => ({
        batch:  cleanStr(row[0]),
        name:   cleanStr(row[1]),
        phone:  cleanStr(row[2]),
    }));

console.log(`Consultants: ${consultants.length}`);

// ── Write data.js ─────────────────────────────────────────────────────────────
const output = `// AUTO-GENERATED by generate-data.js — do not edit manually
// Source: ${FILE}
// Generated: ${new Date().toLocaleString('en-IN')}

const XLSX_DATA = ${JSON.stringify({ responses: allResponses, consultants }, null, 2)};
`;

fs.writeFileSync('data.js', output);
console.log('\n✅ data.js written successfully!');
console.log(`   ${allResponses.length} responses, ${consultants.length} consultants`);
