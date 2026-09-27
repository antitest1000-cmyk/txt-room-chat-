// ============================================================
// CAUGHT ME - Chat App : Google Apps Script Backend
// Sheet: https://docs.google.com/spreadsheets/d/1xL8P3kvsZZmcF8P6PdowHCuJwkyrSfR5T4JWMRYm4I8
// ============================================================

var SPREADSHEET_ID = '1xL8P3kvsZZmcF8P6PdowHCuJwkyrSfR5T4JWMRYm4I8';

// ─── SHEET NAMES ────────────────────────────────────────────
var SHEET_LOGINS   = 'Logins';
var SHEET_CHATS    = 'Chats';
var SHEET_USERS    = 'Users';      // ✅ Registered accounts ONLY
var SHEET_GUESTS   = 'Guests';     // 🔵 Guest/anonymous chatters ONLY
var SHEET_MEDIA    = 'Media';
var SHEET_ROOMS    = 'Rooms';

// ─── HEADERS ────────────────────────────────────────────────
var HEADERS = {
  Logins : ['Timestamp', 'Username', 'Room', 'Gender', 'IP', 'IsGuest', 'UserAgent', 'SessionID'],
  Chats  : ['Timestamp', 'Room', 'Username', 'Message', 'MediaUrl', 'MessageID', 'IsDeleted'],
  Users  : ['Timestamp', 'Username', 'Gender', 'Email', 'LastSeen', 'TotalMessages', 'IsBlocked', 'Password'],
  Guests : ['FirstSeen', 'Username', 'Gender', 'LastSeen', 'TotalMessages', 'LastRoom', 'IsBlocked'],
  Media  : ['Timestamp', 'Username', 'Room', 'CloudinaryURL', 'FileType', 'FileSizeMB'],
  Rooms  : ['Room', 'UserCount', 'LastActivity']
};


// ============================================================
// ENTRY POINT — POST
// ============================================================
function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureSheets(ss);

    var params = JSON.parse(e.postData.contents);
    var action = params.action;

    if      (action === 'register')      return handleRegister(ss, params);
    else if (action === 'login')         return handleLogin(ss, params);
    else if (action === 'chat')          return handleChat(ss, params);
    else if (action === 'media')         return handleMedia(ss, params);
    else if (action === 'deleteMessage') return handleDeleteMessage(ss, params);
    else if (action === 'blockUser')     return handleBlockUser(ss, params);

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch(err) {
    Logger.log('doPost ERROR: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}


// ============================================================
// ENTRY POINT — GET
// ============================================================
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureSheets(ss);

    var action = e.parameter.action || 'getMessages';
    var room   = e.parameter.room   || '';

    if      (action === 'getMessages')  return handleGetMessages(ss, room, e.parameter.since);
    else if (action === 'getUsers')     return handleGetUsers(ss, room);
    else if (action === 'getRooms')     return handleGetRooms(ss);
    else if (action === 'getLogins')    return handleGetLogins(ss);
    else if (action === 'getGuests')    return handleGetGuests(ss);   // NEW

    return jsonResponse({ status: 'error', message: 'Unknown GET action' });

  } catch(err) {
    Logger.log('doGet ERROR: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}


// ============================================================
// ACTION HANDLERS
// ============================================================

// ── REGISTER (Registered accounts → Users sheet) ─────────────
function handleRegister(ss, p) {
  var sheet = ss.getSheetByName(SHEET_USERS);
  var data  = sheet.getDataRange().getValues();

  // Check duplicate username
  for (var i = 1; i < data.length; i++) {
    if (data[i][1].toString().toLowerCase() === p.username.toLowerCase()) {
      return jsonResponse({ status: 'error', message: 'Username already taken' });
    }
  }

  var now = new Date();
  // Columns: Timestamp | Username | Gender | Email | LastSeen | TotalMessages | IsBlocked | Password
  sheet.appendRow([
    now,
    p.username,
    p.gender   || 'unknown',
    p.email    || '',
    now,
    0,
    false,
    p.password || ''   // ⚠️ Hash in production!
  ]);

  return jsonResponse({ status: 'success' });
}


// ── LOGIN ────────────────────────────────────────────────────
function handleLogin(ss, p) {
  var sheet      = ss.getSheetByName(SHEET_LOGINS);
  var usersSheet = ss.getSheetByName(SHEET_USERS);
  var sessionID  = Utilities.getUuid();
  var now        = new Date();

  var finalUsername = p.username || 'Anonymous';
  var finalGender   = p.gender   || 'unknown';
  var isGuest       = (p.isGuest !== undefined) ? p.isGuest : true;

  if (!isGuest) {
    // ── Registered member login ──
    var data = usersSheet.getDataRange().getValues();
    var validLogin = false;
    for (var i = 1; i < data.length; i++) {
      // Columns: [0]Timestamp [1]Username [2]Gender [3]Email [4]LastSeen [5]TotalMessages [6]IsBlocked [7]Password
      if (data[i][1].toString().toLowerCase() === finalUsername.toLowerCase() &&
          data[i][7].toString() === p.password) {
        validLogin    = true;
        finalUsername = data[i][1];
        finalGender   = data[i][2];
        break;
      }
    }
    if (!validLogin) {
      return jsonResponse({ status: 'error', message: 'Invalid username or password' });
    }
    // Update LastSeen for registered user
    upsertRegisteredUser(ss, finalUsername, finalGender);

  } else {
    // ── Guest login ──
    // Prefix with "Guest-" so guests are always visually identifiable
    if (!finalUsername.startsWith('Guest-') && finalUsername !== 'Anonymous') {
      finalUsername = 'Guest-' + finalUsername;
    }
    // Track guest in Guests sheet (NOT Users)
    upsertGuest(ss, finalUsername, finalGender, p.room);
  }

  // Remove stale session for this username
  var activeData = sheet.getDataRange().getValues();
  for (var j = activeData.length - 1; j >= 1; j--) {
    if (activeData[j][1] === finalUsername) {
      sheet.deleteRow(j + 1);
    }
  }

  // Append new login session
  sheet.appendRow([now, finalUsername, p.room || 'general', finalGender, p.ip || '', isGuest, p.userAgent || '', sessionID]);

  // Update room activity
  updateRoomActivity(ss, p.room);

  return jsonResponse({ status: 'success', sessionID: sessionID, isGuest: isGuest });
}


// ── CHAT MESSAGE ─────────────────────────────────────────────
function handleChat(ss, p) {
  var sheet     = ss.getSheetByName(SHEET_CHATS);
  var messageID = Utilities.getUuid();
  var now       = new Date();

  if (isUserBlocked(ss, p.username)) {
    return jsonResponse({ status: 'blocked', message: 'You have been blocked from chatting.' });
  }

  sheet.appendRow([now, p.room || 'general', p.username || 'Anonymous', p.message || '', p.mediaUrl || '', messageID, false]);

  // Increment message count in the right sheet (Users or Guests)
  incrementMessages(ss, p.username);

  updateRoomActivity(ss, p.room);
  return jsonResponse({ status: 'success', messageID: messageID });
}


// ── MEDIA UPLOAD LOG ─────────────────────────────────────────
function handleMedia(ss, p) {
  var sheet = ss.getSheetByName(SHEET_MEDIA);
  sheet.appendRow([new Date(), p.username || 'Anonymous', p.room || 'general', p.cloudinaryUrl || '', p.fileType || 'image', p.fileSizeMB || 0]);
  return jsonResponse({ status: 'success' });
}


// ── DELETE MESSAGE (soft) ────────────────────────────────────
function handleDeleteMessage(ss, p) {
  var sheet = ss.getSheetByName(SHEET_CHATS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][5] === p.messageID) {
      sheet.getRange(i + 1, 7).setValue(true);
      return jsonResponse({ status: 'success', message: 'Message deleted.' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Message not found.' });
}


// ── BLOCK USER ───────────────────────────────────────────────
function handleBlockUser(ss, p) {
  // Try Users sheet first, then Guests
  var blocked = blockInSheet(ss.getSheetByName(SHEET_USERS), p.username, 7);   // col G = IsBlocked (index 6)
  if (!blocked) blockInSheet(ss.getSheetByName(SHEET_GUESTS), p.username, 7);  // col G = IsBlocked (index 6)
  return jsonResponse({ status: 'success' });
}

function blockInSheet(sheet, username, colIndex) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === username) {
      sheet.getRange(i + 1, colIndex).setValue(true);
      return true;
    }
  }
  return false;
}


// ── GET MESSAGES ─────────────────────────────────────────────
function handleGetMessages(ss, room, since) {
  var sheet     = ss.getSheetByName(SHEET_CHATS);
  var data      = sheet.getDataRange().getValues();
  var messages  = [];
  var sinceDate = since ? new Date(since) : null;

  for (var i = 1; i < data.length; i++) {
    var row          = data[i];
    var rowRoom      = String(row[1]);
    var isDeleted    = row[6];
    var msgTimestamp = new Date(row[0]);

    if (rowRoom !== String(room)) continue;
    if (isDeleted === true)       continue;
    if (sinceDate && msgTimestamp <= sinceDate) continue;

    messages.push({ timestamp: row[0], room: row[1], username: row[2], message: row[3], mediaUrl: row[4] || '', messageID: row[5] });
  }
  return jsonResponse(messages.slice(-100));
}


// ── GET ONLINE USERS IN ROOM ──────────────────────────────────
function handleGetUsers(ss, room) {
  var sheet  = ss.getSheetByName(SHEET_LOGINS);
  var data   = sheet.getDataRange().getValues();
  var recent = new Date(Date.now() - 10 * 60 * 1000);
  var seen   = {};
  var users  = [];

  for (var i = data.length - 1; i >= 1; i--) {
    var row       = data[i];
    var loginTime = new Date(row[0]);
    var username  = row[1];
    var loginRoom = row[2];

    if (loginRoom !== room)  continue;
    if (loginTime < recent)  continue;
    if (seen[username])      continue;

    seen[username] = true;
    users.push({ username: username, gender: row[3], isGuest: row[5], joinedAt: row[0] });
  }
  return jsonResponse(users);
}


// ── GET ROOM STATS ────────────────────────────────────────────
function handleGetRooms(ss) {
  var sheet = ss.getSheetByName(SHEET_ROOMS);
  var data  = sheet.getDataRange().getValues();
  var rooms = [];
  for (var i = 1; i < data.length; i++) {
    rooms.push({ room: data[i][0], userCount: data[i][1], lastActivity: data[i][2] });
  }
  return jsonResponse(rooms);
}


// ── GET ALL LOGINS (Admin) ────────────────────────────────────
function handleGetLogins(ss) {
  var sheet  = ss.getSheetByName(SHEET_LOGINS);
  var data   = sheet.getDataRange().getValues();
  var logins = [];
  for (var i = 1; i < data.length; i++) {
    logins.push({ timestamp: data[i][0], username: data[i][1], room: data[i][2], gender: data[i][3], ip: data[i][4], isGuest: data[i][5] });
  }
  return jsonResponse(logins.slice(-200));
}


// ── GET GUESTS (Admin — Guests sheet) ────────────────────────
function handleGetGuests(ss) {
  var sheet  = ss.getSheetByName(SHEET_GUESTS);
  var data   = sheet.getDataRange().getValues();
  var guests = [];
  for (var i = 1; i < data.length; i++) {
    guests.push({
      firstSeen     : data[i][0],
      username      : data[i][1],
      gender        : data[i][2],
      lastSeen      : data[i][3],
      totalMessages : data[i][4],
      lastRoom      : data[i][5],
      isBlocked     : data[i][6]
    });
  }
  return jsonResponse(guests);
}


// ============================================================
// HELPER FUNCTIONS
// ============================================================

// ── Upsert REGISTERED user (Users sheet only) ────────────────
function upsertRegisteredUser(ss, username, gender) {
  var sheet = ss.getSheetByName(SHEET_USERS);
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();
  // Columns: [0]Timestamp [1]Username [2]Gender [3]Email [4]LastSeen [5]TotalMessages [6]IsBlocked [7]Password
  for (var i = 1; i < data.length; i++) {
    if (data[i][1].toString().toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, 5).setValue(now); // Update LastSeen (col E)
      return;
    }
  }
}

// ── Upsert GUEST user (Guests sheet only) ────────────────────
function upsertGuest(ss, username, gender, room) {
  var sheet = ss.getSheetByName(SHEET_GUESTS);
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();
  // Columns: [0]FirstSeen [1]Username [2]Gender [3]LastSeen [4]TotalMessages [5]LastRoom [6]IsBlocked
  for (var i = 1; i < data.length; i++) {
    if (data[i][1].toString().toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, 4).setValue(now);          // LastSeen
      sheet.getRange(i + 1, 6).setValue(room || '');   // LastRoom
      return;
    }
  }
  // New guest — add row
  sheet.appendRow([now, username, gender || 'unknown', now, 0, room || '', false]);
}

// ── Increment message count (routes to correct sheet) ────────
function incrementMessages(ss, username) {
  // Check registered users first
  var usersSheet = ss.getSheetByName(SHEET_USERS);
  var usersData  = usersSheet.getDataRange().getValues();
  for (var i = 1; i < usersData.length; i++) {
    if (usersData[i][1].toString().toLowerCase() === username.toLowerCase()) {
      var cur = Number(usersData[i][5]) || 0;
      usersSheet.getRange(i + 1, 6).setValue(cur + 1); // col F = TotalMessages
      return;
    }
  }
  // Otherwise update guests sheet
  var guestsSheet = ss.getSheetByName(SHEET_GUESTS);
  var guestsData  = guestsSheet.getDataRange().getValues();
  for (var j = 1; j < guestsData.length; j++) {
    if (guestsData[j][1].toString().toLowerCase() === username.toLowerCase()) {
      var curG = Number(guestsData[j][4]) || 0;
      guestsSheet.getRange(j + 1, 5).setValue(curG + 1); // col E = TotalMessages
      return;
    }
  }
}

// ── Block check (searches both sheets) ───────────────────────
function isUserBlocked(ss, username) {
  // Check Users sheet (col G = IsBlocked, index 6)
  var uData = ss.getSheetByName(SHEET_USERS).getDataRange().getValues();
  for (var i = 1; i < uData.length; i++) {
    if (uData[i][1] === username && uData[i][6] === true) return true;
  }
  // Check Guests sheet (col G = IsBlocked, index 6)
  var gData = ss.getSheetByName(SHEET_GUESTS).getDataRange().getValues();
  for (var j = 1; j < gData.length; j++) {
    if (gData[j][1] === username && gData[j][6] === true) return true;
  }
  return false;
}

// ── Room activity ─────────────────────────────────────────────
function updateRoomActivity(ss, room) {
  if (!room) return;
  var sheet = ss.getSheetByName(SHEET_ROOMS);
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === room) {
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  sheet.appendRow([room, 0, now]);
}

// ── Ensure all sheets exist with correct headers ──────────────
function ensureSheets(ss) {
  for (var name in HEADERS) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(HEADERS[name]);
      var headerRange = sheet.getRange(1, 1, 1, HEADERS[name].length);
      headerRange.setBackground('#1e1e1e').setFontColor('#ffffff').setFontWeight('bold');
    }
  }
}

// ── JSON response helper ──────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
