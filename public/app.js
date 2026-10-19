function showStatus(message, type = "info") {
  const status = document.querySelector("#action-status");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.type = type;
}

showStatus("Dashboard ready.");
