const tabWrap  = document.getElementById("tabWrap");
const tabSwap  = document.getElementById("tabSwap");
const panelWrap = document.getElementById("panelWrap");
const panelSwap = document.getElementById("panelSwap");

const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connectBtn");

const wrapBtn = document.getElementById("wrapBtn");
const unwrapBtn = document.getElementById("unwrapBtn");
const swapBtn = document.getElementById("swapBtn");

function log(msg) {
  statusEl.textContent = msg;
}

// TAB SWITCH
tabWrap.onclick = () => {
  tabWrap.classList.add("active");
  tabSwap.classList.remove("active");
  panelWrap.style.display = "block";
  panelSwap.style.display = "none";
  log("");
};

tabSwap.onclick = () => {
  tabSwap.classList.add("active");
  tabWrap.classList.remove("active");
  panelWrap.style.display = "none";
  panelSwap.style.display = "block";
  log("");
};

// CONNECT WALLET
connectBtn.onclick = async () => {
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    log("✅ Wallet connected!");

    wrapBtn.disabled = false;
    unwrapBtn.disabled = false;
    swapBtn.disabled = false;
  } catch (err) {
    log("❌ Wallet connection rejected");
  }
};
