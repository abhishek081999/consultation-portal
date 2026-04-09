# Bidirectional Sync with Google Sheets

To enable changes made in the dashboard (like assigning consultants) to reflect back in your Google Spreadsheet, follow these steps to set up a **Google Apps Script** as a backend.

## 1. Open your Google Spreadsheet
Go to the spreadsheet at: [https://docs.google.com/spreadsheets/d/1SpdyxWW0cHxDUUuy6VrquASgBjucEpFAFPJuuXuSKNU/edit](https://docs.google.com/spreadsheets/d/1SpdyxWW0cHxDUUuy6VrquASgBjucEpFAFPJuuXuSKNU/edit)

## 2. Open Apps Script
* Click on **Extensions** > **Apps Script**.
* Delete any existing code in the editor and paste the following:

```javascript
/**
 * JYOTISH PORTAL SYNC SCRIPT
 * This script handles updates from the JS dashboard.
 * It dynamically finds columns to handle inconsistent sheet layouts.
 */

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return createResponse({success: false, error: "Invalid JSON"});
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ACTION: Update Assignment
  if (data.action === "updateAssignment") {
    var sheet = ss.getSheetByName("Assignee of Hanuman");
    if (!sheet) return createResponse({success: false, error: "Sheet not found"});
    
    var headers = sheet.getRange(1, 1, 1, Math.max(15, sheet.getLastColumn())).getValues()[0];
    var colMap = {};
    var lastHeaderCol = 0;
    headers.forEach(function(h, i) { 
      var name = String(h).toLowerCase().trim();
      if (name) lastHeaderCol = i + 1;
      if (name.includes("s.no") || name === "column 1") colMap.sno = i + 1;
      if (name === "consulatant") colMap.consultant = i + 1;
      if (name === "consulatnt foundation") {
        if (!colMap.foundation1) colMap.foundation1 = i + 1;
        else colMap.foundation2 = i + 1;
      }
      if (name === "status") colMap.status = i + 1;
      if (name.includes("first pref")) colMap.firstPref = i + 1;
      if (name === "feedback" || name === "feedback rating") colMap.feedback = i + 1;
      if (name === "notes" || name.includes("consultation notes")) colMap.notes = i + 1;
    });

    // Ensure columns for Feedback and Notes exist within the active range
    if (!colMap.feedback) {
       var newCol = lastHeaderCol + 1;
       sheet.getRange(1, newCol).setValue("Feedback Rating").setFontWeight("bold");
       colMap.feedback = newCol;
       lastHeaderCol = newCol;
    }
    if (!colMap.notes) {
       var newCol = lastHeaderCol + 1;
       sheet.getRange(1, newCol).setValue("Consultation Notes").setFontWeight("bold");
       colMap.notes = newCol;
    }

    var values = sheet.getDataRange().getValues();
    var rowIdx = -1;
    var targetSno = String(data.rowNum).trim();
    
    // Safety check: Prevent status keywords from leaking into consultant/foundation columns
    var statusLabels = ['done', 'allocated', 'pending', 'dnp', 'refund', 'allotment changed'];
    function clean(val) {
       if (!val) return "";
       if (statusLabels.includes(String(val).toLowerCase().trim())) return "";
       return val;
    }

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === targetSno) {
        rowIdx = i + 1;
        if (colMap.consultant)  sheet.getRange(rowIdx, colMap.consultant).setValue(clean(data.consultant));
        if (colMap.foundation1) sheet.getRange(rowIdx, colMap.foundation1).setValue(clean(data.foundation));
        if (colMap.foundation2) sheet.getRange(rowIdx, colMap.foundation2).setValue(clean(data.foundation2));
        if (colMap.status)      sheet.getRange(rowIdx, colMap.status).setValue(data.status);
        if (colMap.firstPref)   sheet.getRange(rowIdx, colMap.firstPref).setValue(data.firstPref);
        
        if (data.feedback !== undefined && colMap.feedback) sheet.getRange(rowIdx, colMap.feedback).setValue(data.feedback);
        if (data.notes !== undefined && colMap.notes)    sheet.getRange(rowIdx, colMap.notes).setValue(data.notes);
        
        break;
      }
    }

    // 2. Logging to "Consultant_Feedback" (Separate Sheet)
    if (data.feedback || data.notes) {
      var fbSheet = ss.getSheetByName("Consultant_Feedback");
      if (!fbSheet) {
        fbSheet = ss.insertSheet("Consultant_Feedback");
        fbSheet.appendRow(["Timestamp", "S.No", "Client Name", "Consultant", "Status", "Feedback Rating", "Detailed Notes"]);
        fbSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f3f3");
      }
      var clientName = rowIdx > 0 ? sheet.getRange(rowIdx, 2).getValue() : "Unknown";
      fbSheet.appendRow([new Date(), data.rowNum, clientName, data.consultant || "Self", data.status, data.feedback, data.notes]);
    }
    
    return createResponse({success: rowIdx > 0});
  }
  
  if (data.action === "addConsultant") {
    var sheet = ss.getSheetByName("Consultant_List");
    sheet.appendRow([data.batch, data.name, data.phone]);
    return createResponse({success: true});
  }
  
  return createResponse({success: false, error: "Unknown action"});
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return createResponse({status: "ok", message: "API is live"});
}
```

## 3. Deploy as Web App
1. Click the **Deploy** button > **New deployment**.
2. Select type: **Web app**.
3. Description: `Jyotish Sync API`.
4. Execute as: **Me**.
5. Who has access: **Anyone** (This is required for the dashboard to reach the script).
6. Click **Deploy**.
7. **Authorize Access**: It will prompt you to authorize. Click "Advanced" and "Go to JYOTISH SYNC SCRIPT (unsafe)" and then "Allow".
8. **Copy the Web App URL**: It will look like `https://script.google.com/macros/s/.../exec`.

## 4. Update the Dashboard
Paste the **Web App URL** into the `SYNC_URL` constant at the top of your `script.js` file.

---

### How "Vice-Versa" Works:
*   **Sheet to Dashboard**: Whenever you open the dashboard or click "Refresh", it fetches the latest data from the sheet instantly.
*   **Dashboard to Sheet**: Whenever you click "Save Changes" or "Save Consultant", the dashboard sends the update to the Apps Script, which writes it to the sheet.
