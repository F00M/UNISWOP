// =============================
//  CONTRACT ADDRESSES (FIXED)
// =============================
const WGUSDT_ADDRESS = "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6";
const OOPS_ADDRESS   = "0xB0CBCcEe94c957Fa21A97551C825C4e71ADfF93D";
const ROUTER_ADDRESS = "0xe1aEe57F48830876B37A1a7d04d73eF9F1d069f2";
const PAIR_ADDRESS   = "0xc5D2b0D1b6BAe03571dF97D6f389AB47Af7a0d30";

const DECIMALS = 18;

// =============================
//  ABIs
// =============================
const WGUSDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function deposit() payable",
  "function withdraw(uint256)",
  "function approve(address spender,uint256 amount) external returns (bool)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender,uint256 amount) external returns (bool)"
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
//  UI ELEMENTS
// =============================
const tabWrap     = document.getElementById("tabWrap");
const tabSwap     = document.getElementById("tabSwap");
const panelWrap   = document.getElementById("panelWrap");
const panelSwap   = document.getElementById("panelSwap");
const connectBtn  = document.getElementById("connectBtn");
const walletDisp  = document.getElementById("walletDisplay");
const wrapInput   = document.getElementById("wrapInput");
const swapInput   = document.getElementById("swapInput");
const swapOutput  = document.getElementById("swapOutput");
const wrapBtn     = document.getElementById("wrapBtn");
const unwrapBtn   = document.getElementById("unwrapBtn");
const swapBtn     = document.getElementById("swapBtn");
const statusEl    = document.getElementById("status");
const balWgEl     = document.getElementById("balWg");
const balOopsEl   = document.getElementById("balOops");

// =============================
//  STATE
// =============================
let provider, signer, userAddress;
let wgusdt, oopsToken, router, pair;

// =============================
//  HELPERS
// =============================
function log(msg) {
  statusEl.textContent = msg;
}

function appendLog(msg) {
  statusEl.textContent += "\n" + msg;
}

// =============================
//  TAB SWITCH
// =============================
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

// =============================
//  CONNECT WALLET
// =============================
connectBtn.onclick = async () => {
  try {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();
    userAddress = await signer.getAddress();

    wgusdt   = new ethers.Contract(WGUSDT_ADDRESS, WGUSDT_ABI, signer);
    oopsToken= new ethers.Contract(OOPS_ADDRESS,   ERC20_ABI,   signer);
    router   = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI,  signer);
    pair     = new ethers.Contract(PAIR_ADDRESS,   PAIR_ABI,    provider);

    const short = userAddress.slice(0,6) + "..." + userAddress.slice(-4);
    walletDisp.textContent = short;

    wrapBtn.disabled   = false;
    unwrapBtn.disabled = false;
    swapBtn.disabled   = false;

    log("✅ Wallet connected.");
    await refreshBalances();
  } catch (e) {
    console.error(e);
    log("❌ Wallet connection failed.");
  }
};

// =============================
//  REFRESH BALANCES
// =============================
async function refreshBalances() {
  if (!wgusdt || !oopsToken || !userAddress) return;
  try {
    const bg = await wgusdt.balanceOf(userAddress);
    const bo = await oopsToken.balanceOf(userAddress);

    balWgEl.textContent   = ethers.utils.formatUnits(bg, DECIMALS);
    balOopsEl.textContent = ethers.utils.formatUnits(bo, DECIMALS);
  } catch (e) {
    console.error(e);
  }
}

// =============================
//  WRAP / UNWRAP
// =============================
wrapBtn.onclick = async () => {
  try {
    if (!wrapInput.value) {
      alert("Enter amount to wrap.");
      return;
    }

    const amountWei = ethers.utils.parseUnits(wrapInput.value, DECIMALS);
    log("⏳ Wrapping gUSDT → wGUSDT...");

    const tx = await wgusdt.deposit({ value: amountWei });
    appendLog("Tx: " + tx.hash);
    await tx.wait();

    appendLog("✅ Wrap done.");
    await refreshBalances();
  } catch (e) {
    console.error(e);
    log("❌ Wrap failed: " + (e.reason || e.message || "error"));
  }
};

unwrapBtn.onclick = async () => {
  try {
    if (!wrapInput.value) {
      alert("Enter amount to unwrap.");
      return;
    }

    const amountWei = ethers.utils.parseUnits(wrapInput.value, DECIMALS);
    log("⏳ Unwrapping wGUSDT → gUSDT...");

    const tx = await wgusdt.withdraw(amountWei);
    appendLog("Tx: " + tx.hash);
    await tx.wait();

    appendLog("✅ Unwrap done.");
    await refreshBalances();
  } catch (e) {
    console.error(e);
    log("❌ Unwrap failed: " + (e.reason || e.message || "error"));
  }
};

// =============================
//  ESTIMATE SWAP OUTPUT
// =============================
async function getEstimatedOut(amountInBN) {
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  let reserveIn, reserveOut;

  if (token0.toLowerCase() === WGUSDT_ADDRESS.toLowerCase()) {
    reserveIn  = ethers.BigNumber.from(r0.toString());
    reserveOut = ethers.BigNumber.from(r1.toString());
  } else {
    reserveIn  = ethers.BigNumber.from(r1.toString());
    reserveOut = ethers.BigNumber.from(r0.toString());
  }

  const amountInWithFee = amountInBN.mul(997);
  const numerator   = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  const amountOut   = numerator.div(denominator);

  return amountOut;
}

swapInput.oninput = async () => {
  if (!swapInput.value || !pair) {
    swapOutput.value = "";
    return;
  }
  try {
    const amountInBN = ethers.utils.parseUnits(swapInput.value, DECIMALS);
    const outBN = await getEstimatedOut(amountInBN);
    swapOutput.value = ethers.utils.formatUnits(outBN, DECIMALS);
    log("Estimated output only (no slippage check).");
  } catch (e) {
    console.error(e);
    swapOutput.value = "";
  }
};

// =============================
//  SWAP wGUSDT → OOPS
// =============================
swapBtn.onclick = async () => {
  try {
    if (!swapInput.value) {
      alert("Enter amount to swap.");
      return;
    }

    const amountIn = ethers.utils.parseUnits(swapInput.value, DECIMALS);

    log("⏳ Approving router to spend wGUSDT...");
    const txApprove = await wgusdt.approve(ROUTER_ADDRESS, amountIn);
    appendLog("Approve tx: " + txApprove.hash);
    await txApprove.wait();
    appendLog("✅ Approve confirmed.");

    log("⏳ Swapping wGUSDT → OOPS...");
    const txSwap = await router.swapExactTokensForTokens(
      amountIn,
      0, // no slippage minOut (testnet)
      WGUSDT_ADDRESS,
      OOPS_ADDRESS,
      userAddress
    );
    appendLog("Swap tx: " + txSwap.hash);
    await txSwap.wait();

    appendLog("🎉 Swap SUCCESS: wGUSDT → OOPS");
    await refreshBalances();
  } catch (e) {
    console.error(e);
    log("❌ Swap failed: " + (e.reason || e.message || "error"));
  }
};
