(function () {
  "use strict";

  const STORAGE_KEY = "cdailyLearnProgress";
  const EPISODES_URL = "../episodes.json";
  const CONTENT_URL = "./content.json";

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function getModuleProgress(progress, date, questionCount) {
    if (!progress[date]) {
      progress[date] = { answers: new Array(questionCount).fill(null), completed: false };
    }
    return progress[date];
  }

  function isModuleComplete(modProgress) {
    return modProgress.answers.every((a) => a !== null);
  }

  function scoreOf(modProgress, quiz) {
    let correct = 0;
    modProgress.answers.forEach((a, i) => {
      if (a !== null && quiz[i] && a === quiz[i].correct) correct++;
    });
    return correct;
  }

  function renderProgressBar(progress, modules) {
    const total = modules.length;
    const done = modules.filter((m) => {
      const mp = progress[m.date];
      return mp && isModuleComplete(mp);
    }).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      '<div class="progress-bar-wrap">' +
      '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="progress-label">' + done + ' von ' + total + ' Modulen abgeschlossen</div>' +
      "</div>"
    );
  }

  function renderChoice(q, idx, choiceIdx, choiceText, chosen) {
    let cls = "choice";
    let disabledAttr = "";
    if (chosen !== null) {
      disabledAttr = "disabled";
      if (choiceIdx === q.correct) cls += " reveal-correct";
      if (choiceIdx === chosen && chosen !== q.correct) cls += " selected-wrong";
      if (choiceIdx === chosen && chosen === q.correct) cls += " selected-correct";
    }
    return (
      '<button class="' + cls + '" ' + disabledAttr +
      ' data-qidx="' + idx + '" data-cidx="' + choiceIdx + '">' +
      choiceText +
      "</button>"
    );
  }

  function renderQuiz(date, quiz, modProgress) {
    let html = "";
    quiz.forEach((q, i) => {
      const chosen = modProgress.answers[i];
      html += '<div class="quiz-question" data-date="' + date + '" data-qi="' + i + '">';
      html += '<p class="q-text">' + (i + 1) + ". " + q.q + "</p>";
      q.choices.forEach((c, ci) => {
        html += renderChoice(q, i, ci, c, chosen);
      });
      html += "</div>";
    });
    if (isModuleComplete(modProgress)) {
      const score = scoreOf(modProgress, quiz);
      const passCls = score === quiz.length ? "pass" : "fail";
      html +=
        '<p class="quiz-result ' + passCls + '">Ergebnis: ' + score + " von " + quiz.length + " richtig</p>";
      html += '<button class="btn secondary" data-reset="' + date + '">Quiz zuruecksetzen</button>';
    }
    return html;
  }

  function renderModule(ep, content, progress) {
    const modProgress = getModuleProgress(progress, ep.date, content.quiz.length);
    const complete = isModuleComplete(modProgress);
    const statusCls = complete ? "status-done" : "status-open";
    const statusText = complete ? "Erledigt" : "Offen";

    let audioTag = "";
    if (ep.file) {
      audioTag = '<audio controls src="../' + ep.file + '"></audio>';
    }

    let videoTag = "";
    if (content.video_id) {
      videoTag =
        '<div class="video-wrap">' +
        '<div class="video-embed">' +
        '<iframe src="https://www.youtube.com/embed/' + content.video_id + '" ' +
        'title="' + (content.video_title || "YouTube-Video") + '" ' +
        'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
        "</div>" +
        '<p class="video-caption">Video: ' + (content.video_title || "") + "</p>" +
        "</div>";
    } else if (content.article_url) {
      videoTag =
        '<p class="video-caption">Vertiefender Artikel: <a href="' + content.article_url +
        '" target="_blank" rel="noopener">' + content.article_title + "</a></p>";
    }

    let sourceTag = "";
    if (ep.source_name) {
      sourceTag =
        '<p style="font-size:0.85rem;color:var(--muted);margin-top:10px;">Quelle: ' +
        ep.source_name +
        (ep.source_format ? " &ndash; " + ep.source_format : "") +
        (ep.source_url ? ' &mdash; <a href="' + ep.source_url + '" target="_blank" rel="noopener">Link</a>' : "") +
        "</p>";
    }

    return (
      '<div class="module-card" data-date="' + ep.date + '">' +
      '<div class="module-header" data-toggle="' + ep.date + '">' +
      '<div class="module-title-wrap">' +
      '<span class="module-tag">' + (content.area || "Claude Daily") + "</span><br/>" +
      '<span class="module-title">' + ep.title + "</span>" +
      '<div class="module-date">' + ep.date + "</div>" +
      "</div>" +
      '<div class="module-status ' + statusCls + '">' + statusText + "</div>" +
      "</div>" +
      '<div class="module-body" id="body-' + ep.date + '">' +
      "<p>" + content.summary + "</p>" +
      audioTag +
      videoTag +
      sourceTag +
      "<h4>Zum Mitnehmen</h4>" +
      '<ul class="takeaways">' +
      content.takeaways.map((t) => "<li>" + t + "</li>").join("") +
      "</ul>" +
      "<h4>Quiz</h4>" +
      '<div class="quiz-wrap" data-quiz-date="' + ep.date + '">' +
      renderQuiz(ep.date, content.quiz, modProgress) +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function attachHandlers(root, episodes, contentByDate, progress) {
    root.addEventListener("click", function (e) {
      const toggleDate = e.target.closest("[data-toggle]");
      if (toggleDate) {
        const date = toggleDate.getAttribute("data-toggle");
        const body = document.getElementById("body-" + date);
        if (body) body.classList.toggle("open");
        return;
      }

      const choiceBtn = e.target.closest(".choice");
      if (choiceBtn && !choiceBtn.disabled) {
        const questionDiv = choiceBtn.closest(".quiz-question");
        const date = questionDiv.getAttribute("data-date");
        const qi = parseInt(questionDiv.getAttribute("data-qi"), 10);
        const ci = parseInt(choiceBtn.getAttribute("data-cidx"), 10);
        const content = contentByDate[date];
        const modProgress = getModuleProgress(progress, date, content.quiz.length);
        modProgress.answers[qi] = ci;
        saveProgress(progress);
        rerender();
        return;
      }

      const resetBtn = e.target.closest("[data-reset]");
      if (resetBtn) {
        const date = resetBtn.getAttribute("data-reset");
        const content = contentByDate[date];
        progress[date] = { answers: new Array(content.quiz.length).fill(null), completed: false };
        saveProgress(progress);
        rerender();
        return;
      }
    });

    function rerender() {
      const openDates = Array.from(document.querySelectorAll(".module-body.open")).map((el) =>
        el.id.replace("body-", "")
      );
      root.innerHTML =
        renderProgressBar(progress, episodes) +
        episodes.map((ep) => renderModule(ep, contentByDate[ep.date], progress)).join("");
      openDates.forEach((date) => {
        const body = document.getElementById("body-" + date);
        if (body) body.classList.add("open");
      });
    }

    rerender();
  }

  async function init() {
    const root = document.getElementById("app");
    root.innerHTML = "<p>Lade Module ...</p>";
    try {
      const [episodesRes, contentRes] = await Promise.all([fetch(EPISODES_URL), fetch(CONTENT_URL)]);
      const episodes = await episodesRes.json();
      const contentList = await contentRes.json();
      const contentByDate = {};
      contentList.forEach((c) => (contentByDate[c.date] = c));

      const episodesWithContent = episodes
        .filter((ep) => contentByDate[ep.date])
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      const progress = loadProgress();
      attachHandlers(root, episodesWithContent, contentByDate, progress);
    } catch (err) {
      root.innerHTML =
        '<p style="color:var(--bad)">Module konnten nicht geladen werden. Bitte Seite neu laden.</p>';
      console.error(err);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
