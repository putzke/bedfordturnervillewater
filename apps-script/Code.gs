/**
 * Bedford · Turnerville · Thayne Water Study — survey receiver
 * Google Apps Script web app bound to a Google Sheet.
 *
 * Tabs (created automatically on first submission):
 *   "Responses"     anonymous answers, no contact info
 *   "Updates list"  emails only, NOT linked to any response row
 *
 * Deploy: Extensions > Apps Script > paste this file > Deploy > New deployment
 *         Type: Web app | Execute as: Me | Who has access: Anyone
 */

var RESPONSE_HEADERS = ['Timestamp', 'Channel', 'Community', 'Community (other)', 'Water source', 'System', 'System (other)',
  'Feeling about supply', 'Feeling (other)', 'Plans to subdivide (10 yrs)', 'Effect of community water', 'Effect (other)',
  'Comments', 'Nearest road or subdivision', 'Seconds to complete', 'Submission ID'];
var UPDATE_HEADERS = ['Timestamp', 'Email'];

var LABELS = {
  community: { bedford: 'Bedford', turnerville: 'Turnerville', thayne: 'Thayne', other: 'Other' },
  source: { well: 'Individual well', comm: 'Community water system', none: 'No water source' },
  system: { bedford: 'Bedford Water System', thayne: 'Thayne Water System', turnerville: 'Turnerville Water System', northforty: 'North Forty system', other: 'Other' },
  feel: {
    satisfied: 'Satisfied', prefer: 'Prefer to connect to community system', consider: 'Would consider connecting',
    ownwell: 'Prefer own well', concerns: 'Generally satisfied, has concerns', other: 'Other'
  },
  subdivide: { yes: 'Yes', no: 'No', maybe: 'Maybe / Undecided' },
  waterEffect: {
    more: 'More likely to subdivide', lots: 'Could allow more lots', otherway: 'Affects decision another way',
    no: 'No effect', unsure: 'Unsure'
  }
};

var MIN_SECONDS = 4;       // faster than this is almost certainly a bot
var MAX_FIELD = 2000;

function doGet() {
  return json_({ ok: true, service: 'water-survey' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Spam checks. Pretend success so bots learn nothing.
    if (d.website) return json_({ ok: true });
    if (typeof d.elapsedMs === 'number' && d.elapsedMs < MIN_SECONDS * 1000) return json_({ ok: true });

    var id = clean_(d.submissionId, 64);
    if (!id) return json_({ ok: false, error: 'bad request' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var resp = tab_(ss, 'Responses', RESPONSE_HEADERS);

    // Dedupe on submission ID (double-taps, retries).
    var last = resp.getLastRow();
    if (last > 1) {
      var ids = resp.getRange(2, RESPONSE_HEADERS.length, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return json_({ ok: true, duplicate: true });
    }

    var a = d.answers || {};
    var now = new Date();
    resp.appendRow([
      now,
      clean_(d.src, 24),
      label_('community', a.community), clean_(a.communityOther, 300),
      label_('source', a.source),
      label_('system', a.system), clean_(a.systemOther, 300),
      label_('feel', a.feel), clean_(a.feelOther, 300),
      label_('subdivide', a.subdivide),
      label_('waterEffect', a.waterEffect), clean_(a.waterEffectOther, 300),
      clean_(d.comments, MAX_FIELD),
      clean_(d.area, 120),
      Math.round((Number(d.elapsedMs) || 0) / 1000),
      id
    ]);

    if (d.wantUpdates === 'yes') {
      var email = clean_(d.email, 200);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        var ul = tab_(ss, 'Updates list', UPDATE_HEADERS);
        ul.appendRow([now, email]);   // deliberately no link to the response row
      }
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function tab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}

function label_(group, v) {
  v = clean_(v, 40);
  return (LABELS[group] && LABELS[group][v]) || v;
}

// Trim, truncate, and defuse spreadsheet formulas (=, +, -, @ at start).
function clean_(v, max) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || MAX_FIELD);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
