/**
 * Request a new block for a miner address.
 *
 * @param {string} minerAddress - The address receiving the mining reward.
 * @returns {Promise<Object>} The API response containing the mined block.
 */
async function mineBlock(minerAddress) {
  return requestJson("/api/mining", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ minerAddress }),
  });
}

/**
 * Mine a new block for the selected browser wallet.
 *
 * @param {SubmitEvent} event - The mining form submission event.
 * @returns {Promise<void>} Resolves after mining and dashboard refresh finish.
 */
async function handleMiningSubmit(event) {
  event.preventDefault();

  if (!browserWallet) {
    const message = "Create a browser wallet before mining a block.";
    elements.miningStatus.textContent = message;
    showStatus(message, "error");
    return;
  }

  const minerAddress = elements.minerAddress.value.trim();

  if (!addressPattern.test(minerAddress)) {
    const message = "Enter a valid 64-character miner address.";
    elements.miningStatus.textContent = message;
    showStatus(message, "error");
    return;
  }

  elements.miningSubmitButton.disabled = true;
  elements.miningStatus.textContent = "Mining block...";

  try {
    const response = await mineBlock(minerAddress);

    elements.miningStatus.textContent =
      response.message || "Block mined successfully.";

    showStatus("Block mined successfully.", "success");

    await refreshData();
  } catch (error) {
    const message = error.message || "Failed to mine block.";
    elements.miningStatus.textContent = message;
    showStatus(message, "error");
  } finally {
    elements.miningSubmitButton.disabled = false;
  }
}

elements.miningForm.addEventListener(
  "submit",
  handleMiningSubmit,
);