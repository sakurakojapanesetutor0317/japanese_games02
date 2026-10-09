/* =========================================================
   Sakura Japanese — Monthly Reading pages (shared behaviour)
   Each page provides its own data in two JSON blocks:
     <script type="application/json" id="vocab-data">  { key: {w, r, pos, m, ej, ee, note} }
     <script type="application/json" id="quiz-data">   [[question, [A,B,C,D], answerIndex, explanation], ...]
   Everything else (reading text, grammar cards) is plain HTML.
   ========================================================= */
(function () {
  "use strict";

  var body = document.body;
  var DICT = readJSON("vocab-data") || {};

  function readJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- text helpers ---------- */
  /* What the learner currently sees, without ruby readings (used for audio and pop-up "In this text"). */
  function plain(el) {
    var c = el.cloneNode(true);
    c.querySelectorAll("rt").forEach(function (r) { r.remove(); });
    return c.textContent.replace(/\s+/g, " ").trim();
  }
  /* Kana reading of an element: every <ruby> is replaced by its reading. Used for speech so names and kanji are read correctly. */
  function reading(el) {
    var c = el.cloneNode(true);
    c.querySelectorAll("ruby").forEach(function (r) {
      var rt = Array.prototype.map.call(r.querySelectorAll("rt"), function (x) { return x.textContent; }).join("");
      r.replaceWith(document.createTextNode(rt || r.textContent));
    });
    return c.textContent.replace(/\s+/g, " ").trim();
  }

  /* ---------- speech ---------- */
  function say(text) {
    try {
      if (!("speechSynthesis" in window) || !text) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP"; u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  }

  /* ---------- display modes: kana / kanji / ruby ----------
     Ruby markup stays in the HTML. Kana mode swaps each <ruby> for its reading inside
     the elements listed below and restores the original markup when leaving kana mode,
     so word spans (.w) and their data-k keys are never lost. */
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-script-mode]"));
  var modeTargets = Array.prototype.slice.call(document.querySelectorAll(".sent .jp, .vocabulary-card p, .grammar-example, .talk-panel .prompt"));
  var originals = modeTargets.map(function (el) { return el.innerHTML; });
  var mode = "ruby";

  function toKana(html) {
    var t = document.createElement("template");
    t.innerHTML = html;
    t.content.querySelectorAll("ruby").forEach(function (r) {
      var rt = Array.prototype.map.call(r.querySelectorAll("rt"), function (x) { return x.textContent; }).join("");
      if (rt) r.replaceWith(document.createTextNode(rt));
    });
    return t.innerHTML;
  }
  function setMode(next) {
    mode = next;
    body.classList.remove("script-kana", "script-kanji", "script-ruby");
    body.classList.add("script-" + mode);
    modeTargets.forEach(function (el, i) { el.innerHTML = mode === "kana" ? toKana(originals[i]) : originals[i]; });
    modeButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.scriptMode === mode)); });
    closePop();
    if (quiz) quiz.render();          /* quiz text follows the same mode */
  }
  modeButtons.forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.scriptMode); }); });
  function inMode(html) { return mode === "kana" ? toKana(html) : html; }

  /* ---------- translations ---------- */
  var trSwitch = document.getElementById("translation-switch");
  if (trSwitch) {
    trSwitch.addEventListener("change", function () {
      body.classList.toggle("tr-all", trSwitch.checked);
      if (!trSwitch.checked) document.querySelectorAll(".sent.show").forEach(function (s) { s.classList.remove("show"); });
    });
  }

  /* ---------- vocabulary pop-up ---------- */
  var pop = document.getElementById("pop");
  var popBg = document.getElementById("pop-bg");
  var activeWord = null;

  function closePop() {
    if (!pop) return;
    pop.hidden = true; if (popBg) popBg.hidden = true;
    if (activeWord) activeWord.classList.remove("active");
    activeWord = null;
  }
  function openPop(el) {
    var d = DICT[el.dataset.k];
    if (!d || !pop) return;
    if (activeWord && activeWord.dataset.k === el.dataset.k && activeWord === el) { closePop(); return; }
    if (activeWord) activeWord.classList.remove("active");
    activeWord = el; el.classList.add("active");

    var surface = plain(el);
    var base = d.w.replace(/（.*?）/g, "");
    var showForm = surface !== base && surface !== d.r && surface.replace(/な$/, "") !== base;
    pop.innerHTML =
      '<button class="pop-x" type="button" aria-label="Close">×</button>' +
      '<div class="pop-head"><div class="pop-word">' + esc(d.w) + '</div>' +
      '<button class="pop-say" type="button" aria-label="Listen">🔊</button></div>' +
      (d.r !== d.w ? '<div class="pop-read">' + esc(d.r) + '</div>' : "") +
      '<span class="pop-pos">' + esc(d.pos) + '</span>' +
      '<div class="pop-mean">' + esc(d.m) + '</div>' +
      (showForm ? '<div class="pop-form">In this text: <b>' + esc(surface) + '</b></div>' : "") +
      (d.note ? '<div class="pop-note">💡 ' + esc(d.note) + '</div>' : "") +
      (d.ej ? '<div class="pop-ex"><div class="pop-ex-lbl">Example</div><div class="pop-ex-jp">' + inMode(d.ej) + '</div><div class="pop-ex-en">' + esc(d.ee) + '</div></div>' : "");
    pop.querySelector(".pop-x").addEventListener("click", closePop);
    pop.querySelector(".pop-say").addEventListener("click", function () { say(d.r); });
    pop.hidden = false; if (popBg) popBg.hidden = false;

    if (window.matchMedia("(max-width: 640px)").matches) return;   /* phones: bottom sheet via CSS */
    var r = el.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = r.left + window.scrollX + r.width / 2 - pw / 2;
    left = Math.max(window.scrollX + 12, Math.min(left, window.scrollX + document.documentElement.clientWidth - pw - 12));
    var top = r.bottom + window.scrollY + 8;
    if (r.bottom + ph + 16 > window.innerHeight && r.top - ph - 8 > 60) top = r.top + window.scrollY - ph - 8;
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }

  /* One delegated click handler for words, per-sentence buttons and closing the pop-up.
     Because it is delegated, words keep working after the display mode re-renders the text. */
  document.addEventListener("click", function (e) {
    var w = e.target.closest(".w");
    if (w) { e.stopPropagation(); openPop(w); return; }
    var tr = e.target.closest(".b-tr");
    if (tr) { var s = tr.closest(".sent"); s.classList.toggle("show"); tr.setAttribute("aria-pressed", String(s.classList.contains("show"))); return; }
    var sp = e.target.closest(".b-say");
    if (sp) { say(reading(sp.closest(".sent").querySelector(".jp"))); return; }
    if (!e.target.closest(".pop")) closePop();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePop();
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("w")) { e.preventDefault(); openPop(e.target); }
  });
  window.addEventListener("resize", closePop);

  /* ---------- grammar cards: show / hide ---------- */
  document.querySelectorAll(".grammar-collapse").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var cards = btn.closest(".grammar-area").querySelector(".grammar-cards");
      var hide = !cards.hidden;
      cards.hidden = hide;
      btn.textContent = hide ? "See More ＋" : "See Less −";
      btn.setAttribute("aria-expanded", String(!hide));
    });
  });

  /* ---------- reading quiz ---------- */
  var quiz = null;
  (function () {
    var host = document.querySelector("[data-quiz]");
    var questions = readJSON("quiz-data");
    if (!host || !questions || !questions.length) return;
    var view = host.querySelector(".quiz-view");
    var results = host.querySelector(".quiz-results");
    var i = 0, selected = questions.map(function () { return null; }), submitted = false, note = "";

    function render() {
      var q = questions[i];
      var html =
        '<div class="quiz-heading"><h2>Reading Quiz</h2><span class="quiz-count">' + (i + 1) + ' / ' + questions.length + '</span></div>' +
        '<div class="quiz-question">' + inMode(q[0]) + '</div><div class="quiz-options">';
      q[1].forEach(function (opt, j) {
        html += '<button type="button" class="quiz-option" data-j="' + j + '" aria-pressed="' + (selected[i] === j) + '"' + (submitted ? " disabled" : "") + '>' +
                '<span class="letter">' + String.fromCharCode(65 + j) + '</span><span>' + inMode(opt) + '</span></button>';
      });
      html += '</div><div class="quiz-actions">' +
        '<button type="button" class="quiz-btn" data-act="prev"' + (i === 0 ? " disabled" : "") + '>← Previous</button>' +
        '<button type="button" class="quiz-btn" data-act="next"' + (submitted ? " disabled" : "") + '>' + (i === questions.length - 1 ? "Submit" : "Next →") + '</button></div>' +
        '<div class="quiz-note" aria-live="polite">' + esc(note) + '</div>';
      view.innerHTML = html;
    }
    function buildResults() {
      var score = questions.reduce(function (n, q, j) { return n + (selected[j] === q[2] ? 1 : 0); }, 0);
      var html = '<h3>Result: ' + score + ' / ' + questions.length + '</h3><p>Review your answers and explanations below.</p>';
      questions.forEach(function (q, j) {
        var good = selected[j] === q[2];
        html += '<div class="quiz-review ' + (good ? "good" : "bad") + '">' + (j + 1) + '. ' + inMode(q[0]) +
          ' — <span class="verdict">' + (good ? "✓ Correct" : "✕ Incorrect") + '</span>' +
          (good ? "" : '<br>Your answer: ' + inMode(q[1][selected[j]])) +
          '<br>Correct answer: ' + inMode(q[1][q[2]]) + '<br>' + inMode(q[3]) + '</div>';
      });
      html += '<button type="button" class="quiz-btn" data-act="again">Try Again</button>';
      results.innerHTML = html; results.hidden = false;
    }
    function submit() {
      submitted = true; note = "";
      buildResults(); render();
      results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    host.addEventListener("click", function (e) {
      var opt = e.target.closest(".quiz-option");
      if (opt && !submitted) { selected[i] = Number(opt.dataset.j); note = ""; render(); return; }
      var act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "prev" && i > 0) { i--; note = ""; render(); }
      else if (act.dataset.act === "next") {
        if (i < questions.length - 1) { i++; note = ""; render(); }
        else {
          var missing = selected.indexOf(null);
          if (missing !== -1) { note = "Please answer question " + (missing + 1) + " before submitting."; render(); return; }
          submit();
        }
      }
      else if (act.dataset.act === "again") {
        selected = questions.map(function () { return null; }); submitted = false; i = 0; note = "";
        results.hidden = true; results.innerHTML = ""; render();
      }
    });
    quiz = { render: function () { render(); if (submitted) buildResults(); } };
    render();
  })();

  setMode("ruby");
})();
