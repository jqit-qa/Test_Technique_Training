(() => {
  "use strict";

  const completionKey = "production:quiz";

  function isTrainingComplete(rawState, version) {
    try {
      const state = JSON.parse(rawState);
      return state?.version === version && Array.isArray(state.completed) && state.completed.includes(completionKey);
    } catch (_) {
      return false;
    }
  }

  function renderClearMarks() {
    document.querySelectorAll("[data-training]").forEach((card) => {
      const complete = isTrainingComplete(localStorage.getItem(card.dataset.storageKey), Number(card.dataset.storageVersion));
      card.classList.toggle("complete", complete);
      card.querySelector(".clear-mark").hidden = !complete;
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key && document.querySelector(`[data-storage-key="${event.key}"]`)) renderClearMarks();
  });
  window.addEventListener("pageshow", renderClearMarks);
  window.TRAINING_LANDING = { isTrainingComplete };
  renderClearMarks();
})();
