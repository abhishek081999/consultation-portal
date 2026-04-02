# Link UI to Google Sheet Using Apps Script

To fully link your new custom HTML form to your existing Google Sheet, follow these simple steps to create a webhook endpoint using Google Apps Script. 

**This replaces your Google Form exactly while using your new premium UI!**

### Step 1: Open Your Google Sheet
1. Open the existing Google Sheet where you collect the data (e.g., "Makar Sankranti Special").
2. In the top menu, click on **Extensions** > **Apps Script**.

### Step 2: Add the Code
1. A new tab will open with a code editor. Replace any code in `Code.gs` with the following:

```javascript
function doPost(e) {
  try {
    // 1. Get the active sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 2. Parse the incoming JSON data from our custom UI
    var data = JSON.parse(e.postData.contents);
    
    // 3. Define the headers exact order as your excel file (0-indexed)
    // Note: Column names must match the "name" attributes in your HTML exactly!
    var rowData = [
      data["Timestamp"],
      data["Email address"],
      data["Contact Number (Whatsapp )"],
      data["Are you new to our services or have you used our services before?"],
      data["Your Name"],
      data["Gender"],
      data["Your Date of Birth"],
      data["Time of Born "],
      data["Place you Born"],
      data["Select and Write Your concern which is selected "],
      data["Write detail of consult Query "],
      data["Payment Method"],
      data["Upload your payment screenshot (Mandatory for confirmation). Without this, your consultation cannot be scheduled."],
      data["How did you hear about us?"],
      "Confirmed" // For the Response Confirmation column
    ];
    
    // 4. Append the data to the next empty row
    sheet.appendRow(rowData);
    
    // 5. Return success to the UI
    return ContentService
      .createTextOutput(JSON.stringify({ "status": "success", "message": "Uploaded successfully" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error if something goes wrong
    return ContentService
      .createTextOutput(JSON.stringify({ "status": "error", "message": error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET requests (Options preflight / CORS stuff)
function doGet(e) {
  return ContentService.createTextOutput("This is a webhook to receive POST requests.");
}
```

### Step 3: Deploy as Web App
1. Click the **Deploy** button (top right corner) and select **New deployment**.
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
3. Fill in the details:
   * **Description**: Custom Booking Form Endpoint
   * **Execute as**: `Me (your email)`
   * **Who has access**: `Anyone` (Important!)
4. Click **Deploy**.
5. *Note: You will be asked to authorize access. Click "Review permissions", choose your account. If you see a warning, click "Advanced" and "Go to (unsafe)".*
6. Copy the **Web app URL** generated at the end.

### Step 4: Link It to Your Code
1. Open the `script.js` file in your code editor.
2. Find line 13: `const APPS_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';`
3. Replace `'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'` with the URL you copied in Step 3.
4. Uncomment the `fetch` code block on lines 47-58 in `script.js` to enable real requests! 

Now, every time somebody books a consultation on your custom UI, it will show up directly in your Google Sheet!
