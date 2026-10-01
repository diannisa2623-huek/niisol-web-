/**
 * Loka Kota – Backend Google Apps Script (versi final)
 * Buka dari spreadsheet: Extensions > Apps Script, lalu tempel kode ini.
 * Jalankan fungsi setup() sekali untuk memberi izin akses, kemudian Deploy sebagai Web app.
 */
var SPREADSHEET_ID = "";   // Kosongkan jika script dibuka dari menu Extensions di spreadsheet
var SHEET_NAME = "Votes";
var CITIES = ["Yogyakarta", "Bandung", "Jakarta", "Malang", "Surabaya", "Denpasar", "Medan", "Makassar"];

function getSheet_() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Spreadsheet tidak ditemukan. Buka Apps Script lewat Extensions di spreadsheet, atau isi SPREADSHEET_ID.");
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["Waktu", "Nama", "Kota", "Alasan", "ID"]);
    sh.getRange("A1:E1").setFontWeight("bold").setBackground("#cfeafb");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Jalankan sekali dari editor untuk membuat sheet dan memberi izin
function setup() {
  getSheet_();
  Logger.log("Siap. Sheet '" + SHEET_NAME + "' tersedia.");
}

// Mencegah teks dibaca sebagai rumus di spreadsheet
function safe_(v) {
  v = String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim();
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try {
    var sh = getSheet_();
    var last = sh.getLastRow();
    var counts = {};
    CITIES.forEach(function (c) { counts[c] = 0; });
    var recent = [], total = 0;

    if (last > 1) {
      var rows = sh.getRange(2, 1, last - 1, 5).getValues();
      rows.forEach(function (r) {
        var city = String(r[2]);
        if (counts.hasOwnProperty(city)) { counts[city]++; total++; }
      });
      rows.slice(-6).reverse().forEach(function (r) {
        recent.push({ name: String(r[1]), city: String(r[2]), reason: String(r[3]), id: String(r[4]) });
      });
    }
    return json_({ ok: true, counts: counts, total: total, recent: recent });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(20000);
    locked = true;
    if (!e || !e.postData || !e.postData.contents) return json_({ ok: false, error: "Data kosong" });
    var data = JSON.parse(e.postData.contents);
    var city = String(data.city || "");
    if (CITIES.indexOf(city) === -1) return json_({ ok: false, error: "Kota tidak valid" });

    var id = String(data.id || "").replace(/[^A-Za-z0-9]/g, "").substring(0, 40);
    var sh = getSheet_();
    var last = sh.getLastRow();

    // Tolak pengiriman ganda dengan ID yang sama (aman untuk kirim ulang)
    if (id && last > 1) {
      var start = Math.max(2, last - 199);
      var ids = sh.getRange(start, 5, last - start + 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === id) return json_({ ok: true, duplicate: true });
      }
    }

    sh.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      safe_(data.name).substring(0, 40),
      city,
      safe_(data.reason).substring(0, 200),
      id
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}
