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
 * Created for: 1SpdyxWW0cHxDUUuy6VrquASgBjucEpFAFPJuuXuSKNU
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
    var values = sheet.getDataRange().getValues();
    var success = false;
    
    // Find row by S.No (Column A)
    for (var i = 1; i < values.length; i++) {
        // Find row by matching S.No (or name/phone if S.No is missing)
      if (String(values[i][0]).trim() === String(data.rowNum).trim()) {
        // Col K (11): Consultant, Col L (12): Foundation, Col M (13): Foundation 2, Col N (14): Status, Col O (15): First Pref
        sheet.getRange(i + 1, 11).setValue(data.consultant); 
        sheet.getRange(i + 1, 12).setValue(data.foundation);
        sheet.getRange(i + 1, 13).setValue(data.foundation2);
        sheet.getRange(i + 1, 14).setValue(data.status);
        sheet.getRange(i + 1, 15).setValue(data.firstPref);
        success = true;
        break;
      }
    }
    return createResponse({success: success});
  }
  
  // ACTION: Add Consultant
  if (data.action === "addConsultant") {
    var sheet = ss.getSheetByName("Consultant_List");
    sheet.appendRow([data.batch, data.name, data.phone]);
    return createResponse({success: true});
  }
  
  return createResponse({success: false, error: "Unknown action"});
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
