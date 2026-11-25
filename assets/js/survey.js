/* Water Supply Survey — Bedford · Turnerville · Thayne
   Vanilla JS, no dependencies. Logic is separated from rendering so it can be tested in Node. */
(function (root) {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var QS = [
    { id: 'community', title: 'What community do you live in?', opts: [
      { id: 'bedford', label: 'Bedford' }, { id: 'turnerville', label: 'Turnerville' },
      { id: 'thayne', label: 'Thayne' }, { id: 'other', label: 'Other', text: true } ] },
    { id: 'source', title: 'What is your current source of water?', opts: [
      { id: 'well', label: 'Individual well serving my property' },
      { id: 'comm', label: 'Community water system' },
      { id: 'none', label: 'My property does not currently have a water source' } ] },
    { id: 'system', title: 'Which community water system serves your property?',
      when: function (a) { return a.source === 'comm'; }, opts: [
      { id: 'bedford', label: 'Bedford Water System' }, { id: 'thayne', label: 'Thayne Water System' },
      { id: 'turnerville', label: 'Turnerville Water System' }, { id: 'northforty', label: 'North Forty system' },
      { id: 'other', label: 'Other', text: true } ] },
    { id: 'wellFeel', title: 'How do you feel about your current water supply?',
      when: function (a) { return a.source === 'well'; }, opts: [
      { id: 'satisfied', label: 'I am satisfied with my individual well and prefer to keep it.' },
      { id: 'prefer', label: 'I would prefer to connect to a community water system, recognizing that there would be a cost to connect.' },
      { id: 'consider', label: 'I would consider connecting to a community water system, depending on the cost and other factors.' },
      { id: 'other', label: 'Other', text: true } ] },
    { id: 'commFeel', title: 'How do you feel about your current water supply?',
      when: function (a) { return a.source === 'comm'; }, opts: [
      { id: 'satisfied', label: 'I am satisfied with my community water system.' },
      { id: 'ownwell', label: 'I would prefer to have my own individual well.' },
      { id: 'concerns', label: 'I am generally satisfied but have concerns about my water supply (for example water quality, reliability, pressure or cost).' },
      { id: 'other', label: 'Other', text: true } ] },
    { id: 'subdivide', title: 'Do you anticipate subdividing property within the next 10 years?', opts: [
      { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'maybe', label: 'Maybe / Undecided' } ] },
    { id: 'waterEffect', title: 'If community water service were available, would that affect your decision to subdivide or the number of lots you might create?',
      help: 'Access to community water may affect potential subdivision density, depending on the property’s location and zoning.',
      when: function (a) { return a.subdivide === 'yes' || a.subdivide === 'maybe'; }, opts: [
      { id: 'more', label: 'Yes, access to community water would make me more likely to subdivide.' },
      { id: 'lots', label: 'Yes, access to community water could allow for a greater number of lots.' },
      { id: 'otherway', label: 'Yes, but it would affect my decision in another way', text: true },
      { id: 'no', label: 'No, the availability of community water would not affect my plans.' },
      { id: 'unsure', label: 'Unsure' } ] }
  ];

  /* ---------- pure logic ---------- */
  function visible(a) { return QS.filter(function (q) { return !q.when || q.when(a); }); }
  function findQ(id) { for (var i = 0; i < QS.length; i++) if (QS[i].id === id) return QS[i]; return null; }

  // Remove answers for questions that are no longer shown (e.g. user went back and changed the water source).
  function prune(a) {
    var out = {};
    QS.forEach(function (q) {
      if (q.when && !q.when(a)) return;
      if (a[q.id] === undefined) return;
      out[q.id] = a[q.id];
      var o = null;
      for (var i = 0; i < q.opts.length; i++) if (q.opts[i].id === a[q.id]) o = q.opts[i];
      if (o && o.text && a[q.id + 'Other'] !== undefined) out[q.id + 'Other'] = a[q.id + 'Other'];
    });
    return out;
  }

  function needsText(q, a) {
    var o = null;
    for (var i = 0; i < q.opts.length; i++) if (q.opts[i].id === a[q.id]) o = q.opts[i];
    return !!(o && o.text);
  }

  function canAdvance(q, a) {
    if (!a[q.id]) return false;
    if (needsText(q, a) && !String(a[q.id + 'Other'] || '').trim()) return false;
    return true;
  }

  function emailError(want, email) {
    if (want !== 'yes') return '';
    var e = String(email || '').trim();
    if (!e) return 'Enter your email address, or choose No.';
    if (!EMAIL_RE.test(e)) return 'That email address does not look right. Check it and try again.';
    return '';
  }

  function buildPayload(s, nowMs) {
    var a = prune(s.answers);
    var want = s.want === 'yes' ? 'yes' : 'no';
    return {
      submissionId: s.submissionId,
      src: s.src || 'direct',
      elapsedMs: Math.max(0, nowMs - s.startedAt),
      website: s.honeypot || '',
      answers: {
        community: a.community || '', communityOther: a.communityOther || '',
        source: a.source || '',
        system: a.system || '', systemOther: a.systemOther || '',
        feel: a.wellFeel || a.commFeel || '',
        feelOther: (a.wellFeel === 'other' ? a.wellFeelOther : a.commFeel === 'other' ? a.commFeelOther : '') || '',
        subdivide: a.subdivide || '',
        waterEffect: a.waterEffect || '', waterEffectOther: a.waterEffectOther || ''
      },
      comments: String(s.comments || '').trim(),
      area: String(s.area || '').trim(),
      wantUpdates: want,
      email: want === 'yes' ? String(s.email || '').trim() : ''
    };
  }

  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  var Logic = { QS: QS, visible: visible, prune: prune, canAdvance: canAdvance, emailError: emailError, buildPayload: buildPayload, EMAIL_RE: EMAIL_RE };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Logic; }
  root.SurveyLogic = Logic;
  if (typeof document === 'undefined') return;

  /* ---------- rendering ---------- */
  var cfg = root.SURVEY_CONFIG || {};
  var mount = document.getElementById('sv');
  var params = new URLSearchParams(location.search);
  var st = {
    screen: 'intro', qid: null, answers: {}, comments: '', area: '', want: '', email: '', touched: false,
    sending: false, sendError: '', honeypot: '', submissionId: uuid(), startedAt: Date.now(),
    src: (params.get('src') || 'direct').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'direct'
  };

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function render(focusTarget) {
    var html = '';
    if (st.screen === 'intro') html = introHtml();
    else if (st.screen === 'question') html = questionHtml();
    else if (st.screen === 'final') html = finalHtml();
    else html = thanksHtml();
    mount.innerHTML = html;
    bind();
    if (focusTarget) {
      var el = mount.querySelector(focusTarget);
      if (el) { el.focus({ preventScroll: false }); }
    }
  }

  function introHtml() {
    return '<div class="sv-body">' +
      '<div class="sv-photo" role="img" aria-label="Residents raising their hands at a public meeting"></div>' +
      '<h1 class="big" tabindex="-1" id="focus-h">Water Supply Survey</h1>' +
      '<p>The Wyoming Water Development Commission is funding a regional water supply study for Bedford and Turnerville, including the surrounding areas.</p>' +
      '<p>We want to understand how you get your water today and whether regional options interest you. Your input will help inform the study.</p>' +
      '<div class="sv-chips"><span class="sv-chip">About 5 minutes</span><span class="sv-chip">No name needed</span></div></div>' +
      '<div class="sv-foot"><button type="button" class="sv-btn" id="start">Start the survey</button></div>';
  }

  function progress(pct, n, total) {
    return '<div class="sv-progress"><p class="sv-count">' + (n ? 'Question ' + n + ' of ' + total : 'Last step') + '</p>' +
      '<div class="sv-track" role="progressbar" aria-label="Survey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div></div>';
  }

  function questionHtml() {
    var vis = visible(st.answers);
    var q = findQ(st.qid);
    var idx = vis.indexOf(q);
    var total = vis.length + 1; // + final screen
    var picked = st.answers[q.id];
    var opts = q.opts.map(function (o) {
      var on = picked === o.id;
      return '<label class="sv-opt' + (on ? ' is-on' : '') + '"><input type="radio" name="answer" value="' + o.id + '"' + (on ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
    }).join('');
    var other = '';
    if (needsText(q, st.answers)) {
      other = '<label class="sv-field">Please tell us more<input type="text" id="other-text" maxlength="300" value="' + esc(st.answers[q.id + 'Other'] || '') + '"></label>';
    }
    return progress(Math.round(((idx) / total) * 100), idx + 1, total) +
      '<div class="sv-body"><fieldset class="sv-fs"><legend><h1 tabindex="-1" id="focus-h">' + esc(q.title) + '</h1></legend>' +
      (q.help ? '<p class="sv-help">' + esc(q.help) + '</p>' : '') +
      '<div class="sv-opts">' + opts + '</div></fieldset>' + other + '</div>' +
      '<div class="sv-foot"><button type="button" class="sv-btn ghost" id="back">Back</button>' +
      '<button type="button" class="sv-btn" id="next"' + (canAdvance(q, st.answers) ? '' : ' disabled') + '>Next</button></div>';
  }

  function finalHtml() {
    var err = st.touched ? emailError(st.want, st.email) : '';
    var emailBlock = st.want === 'yes'
      ? '<label class="sv-field">Your email address<input type="email" id="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="' + esc(st.email) + '"' + (err ? ' aria-invalid="true" aria-describedby="email-err"' : '') + '></label>' +
        '<p class="sv-err" id="email-err" role="alert"' + (err ? '' : ' hidden') + '>' + esc(err) + '</p>'
      : '';
    return progress(100, 0, 0) +
      '<div class="sv-body"><h1 tabindex="-1" id="focus-h">Anything else you would like us to know?</h1>' +
      '<label class="sv-field" style="margin-top:16px">Additional comments or concerns about your water supply<textarea id="comments" rows="5" maxlength="2000">' + esc(st.comments) + '</textarea></label>' +
      '<div class="sv-optional"><p class="t">Optional</p><p class="s">Leave these blank to stay anonymous.</p>' +
      '<label class="sv-field" style="margin-top:0">Nearest road or subdivision<input type="text" id="area" maxlength="120" value="' + esc(st.area) + '"></label>' +
      '<fieldset class="sv-fs"><legend class="q">Would you like to receive email updates for this project?</legend>' +
      '<div class="sv-yn"><label class="sv-opt' + (st.want === 'yes' ? ' is-on' : '') + '"><input type="radio" name="updates" value="yes"' + (st.want === 'yes' ? ' checked' : '') + '><span>Yes</span></label>' +
      '<label class="sv-opt' + (st.want === 'no' ? ' is-on' : '') + '"><input type="radio" name="updates" value="no"' + (st.want === 'no' ? ' checked' : '') + '><span>No</span></label></div></fieldset>' +
      emailBlock + '</div>' +
      '<div class="sv-hp" aria-hidden="true"><label>Website<input type="text" id="hp" tabindex="-1" autocomplete="off"></label></div></div>' +
      '<div class="sv-foot" style="flex-wrap:wrap">' +
      (st.sendError ? '<p class="sv-send-err" role="alert" style="flex:1 1 100%">' + esc(st.sendError) + '</p>' : '') +
      '<button type="button" class="sv-btn ghost" id="back"' + (st.sending ? ' disabled' : '') + '>Back</button>' +
      '<button type="button" class="sv-btn" id="submit"' + (st.sending ? ' disabled' : '') + '>' + (st.sending ? 'Sending…' : 'Submit survey') + '</button></div>';
  }

  function thanksHtml() {
    return '<div class="sv-body" style="padding-top:44px"><div class="sv-done"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0B4F5C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h1 tabindex="-1" id="focus-h" style="font-size:30px">Thank you for your time and input!</h1>' +
      '<p>Your answers will help guide the regional water supply study. Results will be posted on the project website.</p></div>' +
      '<div class="sv-foot"><a class="sv-link" style="flex:1" href="' + esc(cfg.HOME_URL || '../') + '">Visit the project website</a></div>';
  }

  function bind() {
    var $ = function (id) { return mount.querySelector(id); };
    if (st.screen === 'intro') {
      $('#start').onclick = function () { st.screen = 'question'; st.qid = QS[0].id; render('#focus-h'); };
    } else if (st.screen === 'question') {
      var q = findQ(st.qid);
      Array.prototype.forEach.call(mount.querySelectorAll('input[name=answer]'), function (r) {
        r.onchange = function () {
          st.answers[q.id] = r.value;
          st.answers = prune(st.answers);
          var focusId = needsText(q, st.answers) ? '#other-text' : null;
          render(null);
          var again = mount.querySelector('input[name=answer][value="' + r.value + '"]');
          if (focusId && $(focusId)) $(focusId).focus(); else if (again) again.focus();
        };
      });
      var ot = $('#other-text');
      if (ot) ot.oninput = function () { st.answers[q.id + 'Other'] = ot.value; $('#next').disabled = !canAdvance(q, st.answers); };
      $('#back').onclick = function () {
        var vis = visible(st.answers), i = vis.indexOf(q);
        if (i <= 0) { st.screen = 'intro'; render('#focus-h'); } else { st.qid = vis[i - 1].id; render('#focus-h'); }
      };
      $('#next').onclick = function () {
        if (!canAdvance(q, st.answers)) return;
        var vis = visible(st.answers), i = vis.indexOf(q);
        if (i >= vis.length - 1) { st.screen = 'final'; render('#focus-h'); } else { st.qid = vis[i + 1].id; render('#focus-h'); }
      };
    } else if (st.screen === 'final') {
      $('#comments').oninput = function (e) { st.comments = e.target.value; };
      $('#area').oninput = function (e) { st.area = e.target.value; };
      $('#hp').oninput = function (e) { st.honeypot = e.target.value; };
      Array.prototype.forEach.call(mount.querySelectorAll('input[name=updates]'), function (r) {
        r.onchange = function () { st.want = r.value; st.touched = false; render(null); var el = $('#email'); if (r.value === 'yes' && el) el.focus(); else { var again = mount.querySelector('input[name=updates][value="' + r.value + '"]'); if (again) again.focus(); } };
      });
      var em = $('#email');
      if (em) {
        em.oninput = function () { st.email = em.value; if (st.touched) refreshEmailErr(); };
        em.onblur = function () { if (st.email) { st.touched = true; refreshEmailErr(); } };
      }
      $('#back').onclick = function () {
        var vis = visible(st.answers); st.qid = vis[vis.length - 1].id; st.screen = 'question'; render('#focus-h');
      };
      $('#submit').onclick = submit;
    }
  }

  function refreshEmailErr() {
    var el = mount.querySelector('#email'), p = mount.querySelector('#email-err');
    var msg = emailError(st.want, st.email);
    if (!el || !p) return;
    p.textContent = msg; p.hidden = !msg;
    if (msg) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'email-err'); } else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
  }

  function submit() {
    if (st.sending) return;
    if (!st.want) { st.sendError = 'Please choose Yes or No for email updates.'; render('#submit'); return; }
    if (st.want === 'yes') {
      st.touched = true;
      if (emailError(st.want, st.email)) { render('#email'); return; }
    }
    st.sendError = '';
    if (!cfg.ENDPOINT) {
      st.sendError = 'This survey is not connected yet, so your answers were not sent. Please try again later or email survey@bedfordturnervillewater.com.';
      render('#submit'); return;
    }
    st.sending = true; render(null);
    var payload = buildPayload(st, Date.now());
    var ctrl = ('AbortController' in root) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(cfg.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(timer);
        if (!j || j.ok !== true) throw new Error('rejected');
        st.sending = false; st.screen = 'thanks'; render('#focus-h');
      })
      .catch(function () {
        clearTimeout(timer);
        st.sending = false;
        st.sendError = 'We could not send your answers. Check your connection and try again. Your answers are still here.';
        render('#submit');
      });
  }

  render(null);
})(typeof window !== 'undefined' ? window : globalThis);
