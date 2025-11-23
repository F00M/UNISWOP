// =============================
//  KONTRAK DI STABLE TESTNET
// =============================
const WGUSDT_ADDRESS = "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6"; // wrapper (wGUSDT)
const OOPS_ADDRESS   = "0xB0CBCcEe94c957Fa21A97551C825C4e71ADfF93D";
const ROUTER_ADDRESS = "0xe1aEe57F48830876B37A1a7d04d73eF9F1d069f2";
const PAIR_ADDRESS   = "0xc5D2b0D1b6BAe03571dF97D6f389AB47Af7a0d30";

const DECIMALS = 18;

// =============================
//  ABIs SIMPLE
// =============================
const WGUSDT_ABI = [
  "function deposit() payable",
  "function withdraw(uint256)",
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];

const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address tokenIn,address tokenOut,address to) external returns (uint)"
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];

// =============================
//  ELEMENT UI
// =============================
const connectBtn = document.getElementById("connectBtn");
const swapBtn    = document.getElementById("swapBtn");
const flipBtn    = document.getElementById("flipBtn");
const fromBtn    = document.getElementById("fromToken");
const toBtn      = document.getElementById("toToken");
const inputEl    = document.getElementById("swapInput");
const outputEl   = document.getElementById("swapOutput");
const statusEl   = document.getElementById("status");
const balFromEl  = document.getElementById("balFrom");

// =============================
//  STATE
// =============================
let provider, signer, userAddress;
let wgusdt, oops, router, pair;

// internal token id: "GUSDT" (native), "WGUSDT", "OOPS"
let fromToken = "WGUSDT";
let toToken   = "OOPS";

const TOKEN_ORDER = ["GUSDT", "WGUSDT", "OOPS"];

// =============================
//  HELPERS
// =============================
function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function short(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function tokenLabel(id) {
  if (id === "GUSDT") return "gUSDT";
  if (id === "WGUSDT") return "wGUSDT";
  return "OOPS";
}

function getActionType() {
  if (fromToken === "GUSDT" && toToken === "WGUSDT") return "WRAP";
  if (fromToken === "WGUSDT" && toToken === "GUSDT") return "UNWRAP";
  if (fromToken === "GUSDT" || toToken === "GUSDT") return "INVALID";
  return "SWAP"; // WGUSDT <-> OOPS
}

function updateTokenButtons() {
  fromBtn.textContent = tokenLabel(fromToken) + " ▾";
  toBtn.textContent   = tokenLabel(toToken)   + " ▾";

  const action = getActionType();
  if (action === "WRAP") {
    swapBtn.textContent = "Wrap gUSDT → wGUSDT";
  } else if (action === "UNWRAP") {
    swapBtn.textContent = "Unwrap wGUSDT → gUSDT";
  } else if (action === "SWAP") {
    swapBtn.textContent = `Swap ${tokenLabel(fromToken)} → ${tokenLabel(toToken)}`;
  } else {
    swapBtn.textContent = "Tidak didukung";
  }

  swapBtn.disabled = !signer || action === "INVALID";
}

// =============================
//  TOKEN SWITCH (CYCLE + FLIP)
// =============================
fromBtn.onclick = () => {
  let idx = TOKEN_ORDER.indexOf(fromToken);
  fromToken = TOKEN_ORDER[(idx + 1) % TOKEN_ORDER.length];

  if (fromToken === toToken) {
    let id2 = TOKEN_ORDER.indexOf(toToken);
    toToken = TOKEN_ORDER[(id2 + 1) % TOKEN_ORDER.length];
  }
  if (fromToken === "GUSDT" && toToken !== "WGUSDT") toToken = "WGUSDT";

  updateTokenButtons();
  updateQuote();
};

toBtn.onclick = () => {
  let idx = TOKEN_ORDER.indexOf(toToken);
  toToken = TOKEN_ORDER[(idx + 1) % TOKEN_ORDER.length];

  if (toToken === fromToken) {
    let id2 = TOKEN_ORDER.indexOf(fromToken);
    fromToken = TOKEN_ORDER[(id2 + 1) % TOKEN_ORDER.length];
  }
  if (toToken === "GUSDT" && fromToken !== "WGUSDT") fromToken = "WGUSDT";

  updateTokenButtons();
  updateQuote();
};

flipBtn.onclick = () => {
  const tmp = fromToken;
  fromToken = toToken;
  toToken   = tmp;

  if (fromToken === "GUSDT" && toToken !== "WGUSDT") toToken = "WGUSDT";
  if (toToken === "GUSDT" && fromToken !== "WGUSDT") fromToken = "WGUSDT";

  updateTokenButtons();
  updateQuote();
};

// =============================
//  CONNECT WALLET
// =============================
connectBtn.onclick = async () => {
  try {
    if (!window.ethereum) {
      alert("Install MetaMask dulu.");
      return;
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();
    userAddress = await signer.getAddress();

    wgusdt = new ethers.Contract(WGUSDT_ADDRESS, WGUSDT_ABI, signer);
    oops   = new ethers.Contract(OOPS_ADDRESS,   ERC20_ABI,   signer);
    router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI,  signer);
    pair   = new ethers.Contract(PAIR_ADDRESS,   PAIR_ABI,    provider);

    connectBtn.textContent = short(userAddress);
    setStatus("✅ Wallet connected.");
    await refreshBalances();
    updateTokenButtons();
  } catch (e) {
    console.error(e);
    setStatus("❌ Gagal connect wallet.");
  }
};

async function refreshBalances() {
  if (!wgusdt || !userAddress) return;
  try {
    const bal = await wgusdt.balanceOf(userAddress);
    balFromEl.textContent = ethers.utils.formatUnits(bal, DECIMALS);
  } catch (e) {
    console.error(e);
  }
}

// =============================
//  QUOTE / ESTIMASI
// =============================
async function updateQuote() {
  const val = inputEl.value.trim();
  outputEl.value = "";
  if (!val) return;

  const action = getActionType();
  if (action === "INVALID") {
    setStatus("Kombinasi token tidak didukung.");
    return;
  }

  try {
    const amountIn = ethers.utils.parseUnits(val, DECIMALS);

    if (action === "WRAP" || action === "UNWRAP") {
      outputEl.value = val;
      setStatus("");
      return;
    }

    // SWAP WGUSDT <-> OOPS
    if (!pair) return;
    const [r0, r1] = await pair.getReserves();
    const token0   = await pair.token0();

    const addrIn  = fromToken === "WGUSDT" ? WGUSDT_ADDRESS : OOPS_ADDRESS;
    const addrOut = toToken   === "WGUSDT" ? WGUSDT_ADDRESS : OOPS_ADDRESS;

    let reserveIn, reserveOut;
    if (addrIn.toLowerCase() === token0.toLowerCase()) {
      reserveIn  = ethers.BigNumber.from(r0.toString());
      reserveOut = ethers.BigNumber.from(r1.toString());
    } else {
      reserveIn  = ethers.BigNumber.from(r1.toString());
      reserveOut = ethers.BigNumber.from(r0.toString());
    }

    const amountInWithFee = amountIn.mul(997);
    const numerator       = amountInWithFee.mul(reserveOut);
    const denominator     = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut       = numerator.div(denominator);

    outputEl.value = ethers.utils.formatUnits(amountOut, DECIMALS);
    setStatus("Estimasi output (tanpa cek slippage).");
  } catch (e) {
    console.error(e);
    setStatus("❌ Gagal hitung estimasi.");
  }
}

inputEl.oninput = () => {
  updateQuote();
};

// =============================
//  MAIN ACTION
// =============================
swapBtn.onclick = async () => {
  const raw = inputEl.value.trim();
  if (!raw) {
    alert("Isi amount dulu.");
    return;
  }
  if (!signer) {
    alert("Connect wallet dulu.");
    return;
  }

  const action = getActionType();
  try {
    const amountWei = ethers.utils.parseUnits(raw, DECIMALS);

    if (action === "WRAP") {
      setStatus("⏳ Wrapping gUSDT → wGUSDT...");
      const tx = await wgusdt.deposit({ value: amountWei });
      setStatus("Tx: " + tx.hash);
      await tx.wait();
      setStatus("✅ Wrap selesai.");
      await refreshBalances();
      return;
    }

    if (action === "UNWRAP") {
      setStatus("⏳ Unwrapping wGUSDT → gUSDT...");
      const tx = await wgusdt.withdraw(amountWei);
      setStatus("Tx: " + tx.hash);
      await tx.wait();
      setStatus("✅ Unwrap selesai.");
      await refreshBalances();
      return;
    }

    if (action === "SWAP") {
      const tokenInAddr  = fromToken === "WGUSDT" ? WGUSDT_ADDRESS : OOPS_ADDRESS;
      const tokenOutAddr = toToken   === "WGUSDT" ? WGUSDT_ADDRESS : OOPS_ADDRESS;

      const tokenIn = fromToken === "WGUSDT" ? wgusdt : oops;

      setStatus("⏳ Approve router...");
      const txApprove = await tokenIn.approve(ROUTER_ADDRESS, amountWei);
      setStatus("Approve tx: " + txApprove.hash);
      await txApprove.wait();

      setStatus("⏳ Swap berjalan...");
      const txSwap = await router.swapExactTokensForTokens(
        amountWei,
        0,
        tokenInAddr,
        tokenOutAddr,
        userAddress
      );
      setStatus("Swap tx: " + txSwap.hash);
      await txSwap.wait();
      setStatus("🎉 Swap sukses.");
      await refreshBalances();
      return;
    }

    setStatus("Kombinasi tidak didukung.");
  } catch (e) {
    console.error(e);
    setStatus("❌ Error: " + (e.reason || e.message || "gagal"));
  }
};

// init
updateTokenButtons();
setStatus("");
