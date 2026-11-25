/* Team page for typing in mailed paper surveys. Reuses SurveyLogic from survey.js. */
(function () {
  'use strict';
  var L = window.SurveyLogic, cfg = window.SURVEY_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  // Same order and numbering as the printed form.
  var ORDER = ['community', 'source', 'wellFeel', 'system', 'commFeel', 'subdivide', 'waterEffect'];
  var qs = ORDER.map(function (id) { return L.QS.filter(function (q) { return q.id === id; })[0]; });
  var answers = {}, saved = 0, submissionId = newId();

  function newId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var SKIPS = { source: { well: 'Go to 3', comm: 'Go to 4', none: 'Go to 6' }, subdivide: { yes: 'Go to 7', maybe: 'Go to 7', no: 'Go to 8' } };

  var GATE = { wellFeel: 'source', system: 'source', commFeel: 'source', waterEffect: 'subdivide' };

  function build() {
    $('qs').innerHTML = qs.map(function (q, i) {
      var opts = q.opts.map(function (o) {
        var skip = SKIPS[q.id] && SKIPS[q.id][o.id];
        return '<label class="sv-opt"><input type="radio" name="' + q.id + '" value="' + o.id + '"><span>' + esc(o.label) + (skip ? ' <em class="en-skip">(' + skip + ')</em>' : '') + '</span></label>';
      }).join('');
      return '<div class="en-card" data-q="' + q.id + '">' +
        '<fieldset class="sv-fs"><legend><h2 class="en-q"><span class="n">' + (i + 1) + '</span>' + esc(q.title) + '</h2></legend><div class="sv-opts">' + opts + '</div>' +
        '<label class="sv-field en-other" hidden>Other (type exactly what is written)<input type="text" maxlength="300" data-other="' + q.id + '"></label></fieldset>' +
        '<p class="en-skipped" hidden>Skipped, based on the earlier answer.</p></div>';
    }).join('');
  }

  function sync() {
    qs.forEach(function (q) {
      var card = document.querySelector('[data-q="' + q.id + '"]');
      var gate = GATE[q.id];
      var show = !q.when || (gate && !answers[gate]) || q.when(answers);
      if (!show) { delete answers[q.id]; delete answers[q.id + 'Other']; }
      card.querySelector('fieldset').hidden = !show;
      card.querySelector('.en-skipped').hidden = show;
      card.classList.toggle('is-skipped', !show);
      if (!show) {
        Array.prototype.forEach.call(card.querySelectorAll('input[type=radio]'), function (r) { r.checked = false; });
        card.querySelector('[data-other]').value = '';
        card.querySelector('.en-other').hidden = true;
      } else {
        card.querySelector('.en-other').hidden = !(function () {
          var o = q.opts.filter(function (x) { return x.id === answers[q.id]; })[0]; return !!(o && o.text);
        })();
      }
      Array.prototype.forEach.call(card.querySelectorAll('.sv-opt'), function (l) { l.classList.toggle('is-on', l.querySelector('input').checked); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name=updates]'), function (r) { r.closest('.sv-opt').classList.toggle('is-on', r.checked); });
  }

  $('qs').addEventListener('change', function (e) {
    var t = e.target; if (t.type !== 'radio') return;
    answers[t.name] = t.value; sync();
  });
  $('qs').addEventListener('input', function (e) {
    var id = e.target.getAttribute('data-other'); if (id) answers[id + 'Other'] = e.target.value;
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=updates]'), function (r) {
    r.addEventListener('change', function () { $('emailwrap').hidden = r.value !== 'yes' || !r.checked; if (r.value !== 'yes') $('email').value = ''; sync(); });
  });

  try { $('key').value = sessionStorage.getItem('entryKey') || ''; } catch (e) { }

  function showErr(m) { var el = $('err'); el.textContent = m; el.hidden = !m; if (m) el.scrollIntoView({ block: 'center' }); }
  function reset() {
    answers = {}; submissionId = newId();
    $('en').reset(); try { $('key').value = sessionStorage.getItem('entryKey') || ''; } catch (e) { }
    $('emailwrap').hidden = true; $('email-err').hidden = true; showErr('');
    document.querySelectorAll('.en-other').forEach(function (n) { n.hidden = true; });
    sync(); window.scrollTo({ top: 0 });
  }
  $('clear').addEventListener('click', function () { if (confirm('Clear everything on this form?')) { $('ok').hidden = true; reset(); } });

  $('en').addEventListener('submit', function (e) {
    e.preventDefault();
    showErr(''); $('ok').hidden = true;
    var key = $('key').value.trim();
    if (!key) { showErr('Enter the team passcode first.'); $('key').focus(); return; }
    var want = (document.querySelector('input[name=updates]:checked') || {}).value || 'no';
    var email = $('email').value.trim();
    var em = L.emailError(want, email);
    if (em) { var p = $('email-err'); p.textContent = em; p.hidden = false; $('email').focus(); return; }
    var pruned = L.prune(answers);
    var anything = Object.keys(pruned).length || $('comments').value.trim() || $('area').value.trim();
    if (!anything) { showErr('Nothing has been entered yet.'); return; }
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i]; if (q.when && !q.when(pruned)) continue;
      if (pruned[q.id] && !L.canAdvance(q, pruned)) { showErr('Question ' + (i + 1) + ': type what is written next to "Other".'); return; }
    }
    if (!cfg.ENDPOINT) { showErr('The survey is not connected to the Sheet yet.'); return; }
    var payload = L.buildPayload({ answers: pruned, comments: $('comments').value, area: $('area').value, want: want, email: email,
      submissionId: submissionId, startedAt: Date.now() - 60000, src: 'paper', honeypot: '' }, Date.now());
    payload.entryKey = key;
    var btn = $('save'); btn.disabled = true; btn.textContent = 'Saving…';
    fetch(cfg.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          try { sessionStorage.setItem('entryKey', key); } catch (e) { }
          saved++; reset();
          var ok = $('ok'); ok.textContent = 'Saved. ' + saved + ' paper survey' + (saved === 1 ? '' : 's') + ' entered this session. Ready for the next one.'; ok.hidden = false;
        } else if (j && j.error === 'key') { showErr('That passcode was not accepted.'); }
        else { showErr('The Sheet did not accept it. Try again.'); }
      })
      .catch(function () { showErr('Could not reach the Sheet. Check your connection and try again. Nothing was lost on this form.'); })
      .then(function () { btn.disabled = false; btn.textContent = 'Save this survey'; });
  });

  build(); sync();
})();
