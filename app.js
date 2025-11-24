// ==== CONFIG ====
const TOKENS = {
  WGUSDT: {
    symbol: "wGUSDT",
    address: "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6",
    decimals: 18,
  },
  OOPS: {
    symbol: "OOPS",
    address: "0xB0CBCcEe94c957Fa21A97551C825C4e71ADfF93D",
    decimals: 18,
  },
};

const PAIR_ADDRESS = "0xc5D2b0D1b6BAe03571dF97D6f389AB47Af7a0d30";
const ROUTER_ADDRESS = "0xe1aEe57F48830876B37A1a7d04d73eF9F1d069f2";
const STABLE_CHAIN_ID = 2201;
const LP_DECIMALS = 18; // Uniswap V2 LP default

// ==== ABIs (minimal) ====
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
];

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA,address tokenB,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) external returns (uint amountA,uint amountB,uint liquidity)",
  "function removeLiquidity(address tokenA,address tokenB,uint liquidity,uint amountAMin,uint amountBMin,address to,uint deadline) external returns (uint amountA,uint amountB)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
];

// ==== GLOBAL STATE ====
let provider, signer, userAddress;
let router, pair;
let token0, token1; // addresses from pair
let fromTokenKey = "WGUSDT";
let toTokenKey = "OOPS";
let currentTokenSide = null; // "from" | "to"

// ==== DOM ====
const connectButton = document.getElementById("connectButton");
const tabSwap = document.getElementById("tab-swap");
const tabLiquidity = document.getElementById("tab-liquidity");
const panelSwap = document.getElementById("panel-swap");
const panelLiquidity = document.getElementById("panel-liquidity");

const swapFromAmount = document.getElementById("swapFromAmount");
const swapToAmount = document.getElementById("swapToAmount");
const swapFromTokenBtn = document.getElementById("swapFromTokenBtn");
const swapToTokenBtn = document.getElementById("swapToTokenBtn");
const swapFromTokenSymbol = document.getElementById("swapFromTokenSymbol");
const swapToTokenSymbol = document.getElementById("swapToTokenSymbol");
const swapFlipButton = document.getElementById("swapFlipButton");
const swapActionButton = document.getElementById("swapActionButton");
const swapStatus = document.getElementById("swapStatus");
const fromBalanceLabel = document.getElementById("fromBalance");
const toBalanceLabel = document.getElementById("toBalance");

const addAmountA = document.getElementById("addAmountA");
const addAmountB = document.getElementById("addAmountB");
const addLpButton = document.getElementById("addLpButton");
const addLpStatus = document.getElementById("addLpStatus");
const lpBalA = document.getElementById("lpBalA");
const lpBalB = document.getElementById("lpBalB");

const lpBalanceSpan = document.getElementById("lpBalance");
const removeLpButton = document.getElementById("removeLpButton");
const removeLpStatus = document.getElementById("removeLpStatus");

const tokenModal = document.getElementById("tokenModal");
const tokenList = document.getElementById("tokenList");
const closeTokenModalBtn = document.getElementById("closeTokenModal");

// ==== HELPERS ====
function setStatus(el, msg) {
  el.textContent = msg || "";
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function getToken(key) {
  return TOKENS[key];
}

function parseAmount(humanStr, tokenKey) {
  // Human: "1" / "0.5" / "10" -> onchain with decimals
  const t = getToken(tokenKey);
  return ethers.utils.parseUnits(humanStr, t.decimals);
}

function formatAmount(bn, tokenKey) {
  const t = getToken(tokenKey);
  return ethers.utils.formatUnits(bn, t.decimals);
}

function nowPlus(seconds) {
  return Math.floor(Date.now() / 1000) + seconds;
}

function otherToken(key) {
  return key === "WGUSDT" ? "OOPS" : "WGUSDT";
}

// ==== UI TABS ====
tabSwap.onclick = () => {
  tabSwap.classList.add("active");
  tabLiquidity.classList.remove("active");
  panelSwap.classList.add("active");
  panelLiquidity.classList.remove("active");
};

tabLiquidity.onclick = () => {
  tabLiquidity.classList.add("active");
  tabSwap.classList.remove("active");
  panelLiquidity.classList.add("active");
  panelSwap.classList.remove("active");
};

// ==== TOKEN SELECTOR ====
function openTokenModal(side) {
  currentTokenSide = side;
  tokenList.innerHTML = "";

  Object.keys(TOKENS).forEach((key) => {
    const t = TOKENS[key];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "token-item";
    btn.innerHTML = `<span>${t.symbol}</span><span>${t.address.slice(
      0,
      6
    )}...${t.address.slice(-4)}</span>`;
    btn.onclick = () => {
      if (side === "from") {
        fromTokenKey = key;
        if (fromTokenKey === toTokenKey) toTokenKey = otherToken(fromTokenKey);
      } else {
        toTokenKey = key;
        if (fromTokenKey === toTokenKey) fromTokenKey = otherToken(toTokenKey);
      }
      updateTokenLabels();
      closeTokenModal();
      updateBalances();
      quoteOutput();
    };
    tokenList.appendChild(btn);
  });

  tokenModal.classList.remove("hidden");
}

function closeTokenModal() {
  tokenModal.classList.add("hidden");
  currentTokenSide = null;
}

swapFromTokenBtn.onclick = () => openTokenModal("from");
swapToTokenBtn.onclick = () => openTokenModal("to");
closeTokenModalBtn.onclick = closeTokenModal;
tokenModal.onclick = (e) => {
  if (e.target === tokenModal) closeTokenModal();
};

function updateTokenLabels() {
  swapFromTokenSymbol.textContent = getToken(fromTokenKey).symbol;
  swapToTokenSymbol.textContent = getToken(toTokenKey).symbol;
}

// ==== CONNECT WALLET ====
connectButton.onclick = async () => {
  try {
    if (!window.ethereum) {
      alert("Install MetaMask dulu.");
      return;
    }
    await ethereum.request({ method: "eth_requestAccounts" });

    provider = new ethers.providers.Web3Provider(window.ethereum);
    const net = await provider.getNetwork();
    if (net.chainId !== STABLE_CHAIN_ID) {
      alert(
        `Pastikan network = Stable Testnet (chainId ${STABLE_CHAIN_ID}). Chain sekarang: ${net.chainId}`
      );
    }

    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    connectButton.textContent = shortAddr(userAddress);

    router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    pair = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

    token0 = (await pair.token0()).toLowerCase();
    token1 = (await pair.token1()).toLowerCase();

    swapActionButton.disabled = false;
    addLpButton.disabled = false;
    removeLpButton.disabled = false;

    await updateBalances();
    await updateLpBalance();
  } catch (e) {
    console.error(e);
    alert("Failed to connect wallet: " + (e.message || e));
  }
};

// ==== BALANCES ====
async function erc20Balance(address, tokenAddress) {
  const c = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return await c.balanceOf(address);
}

async function updateBalances() {
  if (!provider || !userAddress) return;
  try {
    const [balFrom, balTo, balWG, balOOPS] = await Promise.all([
      erc20Balance(userAddress, getToken(fromTokenKey).address),
      erc20Balance(userAddress, getToken(toTokenKey).address),
      erc20Balance(userAddress, TOKENS.WGUSDT.address),
      erc20Balance(userAddress, TOKENS.OOPS.address),
    ]);

    fromBalanceLabel.textContent =
      "Balance: " + formatAmount(balFrom, fromTokenKey);
    toBalanceLabel.textContent =
      "Balance: " + formatAmount(balTo, toTokenKey);

    lpBalA.textContent = "Balance: " + formatAmount(balWG, "WGUSDT");
    lpBalB.textContent = "Balance: " + formatAmount(balOOPS, "OOPS");
  } catch (e) {
    console.error("updateBalances", e);
  }
}

async function updateLpBalance() {
  if (!pair || !userAddress) return;
  try {
    const bal = await pair.balanceOf(userAddress);
    lpBalanceSpan.textContent = ethers.utils.formatUnits(bal, LP_DECIMALS);
  } catch (e) {
    console.error("updateLpBalance", e);
  }
}

// ==== QUOTE (dari reserves pair) ====
async function quoteOutput() {
  if (!pair || !swapFromAmount.value.trim()) {
    swapToAmount.value = "";
    return;
  }
  try {
    const inputHuman = swapFromAmount.value.trim();
    const amountIn = parseAmount(inputHuman, fromTokenKey);

    const [r0, r1] = await pair.getReserves();
    const fromAddr = getToken(fromTokenKey).address.toLowerCase();

    let reserveIn, reserveOut;
    if (fromAddr === token0) {
      reserveIn = r0;
      reserveOut = r1;
    } else {
      reserveIn = r1;
      reserveOut = r0;
    }

    const amountInWithFee = amountIn.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut = numerator.div(denominator);

    swapToAmount.value = formatAmount(amountOut, toTokenKey);
  } catch (e) {
    console.error("quoteOutput", e);
  }
}

swapFromAmount.oninput = () => {
  quoteOutput();
};

// ==== APPROVE HELP ====
async function ensureAllowance(tokenAddress, owner, spender, amount) {
  const c = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const current = await c.allowance(owner, spender);
  if (current.gte(amount)) return;
  const tx = await c.approve(spender, ethers.constants.MaxUint256);
  await tx.wait();
}

// ==== SWAP ====
swapFlipButton.onclick = () => {
  const tmp = fromTokenKey;
  fromTokenKey = toTokenKey;
  toTokenKey = tmp;
  updateTokenLabels();
  quoteOutput();
  updateBalances();
};

swapActionButton.onclick = async () => {
  if (!signer || !userAddress) {
    alert("Connect wallet dulu.");
    return;
  }

  const raw = swapFromAmount.value.trim();
  if (!raw || Number(raw) <= 0) {
    setStatus(swapStatus, "Masukkan jumlah dulu (contoh: 1, 0.5, 10).");
    return;
  }

  const tokenIn = getToken(fromTokenKey);
  const tokenOut = getToken(toTokenKey);

  try {
    const amountIn = parseAmount(raw, fromTokenKey);

    setStatus(
      swapStatus,
      `⏳ Approving ${tokenIn.symbol} (UI otomatis handle decimals)...`
    );
    await ensureAllowance(tokenIn.address, userAddress, ROUTER_ADDRESS, amountIn);

    setStatus(swapStatus, "🔥 Swapping...");
    const path = [tokenIn.address, tokenOut.address];
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      0,
      path,
      userAddress,
      nowPlus(600)
    );
    setStatus(swapStatus, "Tx: " + tx.hash);
    await tx.wait();

    setStatus(swapStatus, "✅ Swap success.");
    await updateBalances();
  } catch (e) {
    console.error("swapAction", e);
    setStatus(
      swapStatus,
      "❌ " +
        (e.reason || e.data?.message || e.message || "Swap failed / execution reverted")
    );
  }
};

// ==== ADD LIQUIDITY ====
addLpButton.onclick = async () => {
  if (!signer || !userAddress) {
    alert("Connect wallet dulu.");
    return;
  }

  const rawA = addAmountA.value.trim();
  const rawB = addAmountB.value.trim();
  if (!rawA || !rawB || Number(rawA) <= 0 || Number(rawB) <= 0) {
    setStatus(
      addLpStatus,
      "Isi jumlah wGUSDT & OOPS (contoh: 1 dan 0.5, bukan angka decimals)."
    );
    return;
  }

  try {
    const amountA = parseAmount(rawA, "WGUSDT");
    const amountB = parseAmount(rawB, "OOPS");

    setStatus(addLpStatus, "⏳ Approve wGUSDT...");
    await ensureAllowance(
      TOKENS.WGUSDT.address,
      userAddress,
      ROUTER_ADDRESS,
      amountA
    );

    setStatus(addLpStatus, "⏳ Approve OOPS...");
    await ensureAllowance(
      TOKENS.OOPS.address,
      userAddress,
      ROUTER_ADDRESS,
      amountB
    );

    setStatus(addLpStatus, "🔥 Adding liquidity...");
    const tx = await router.addLiquidity(
      TOKENS.WGUSDT.address,
      TOKENS.OOPS.address,
      amountA,
      amountB,
      0,
      0,
      userAddress,
      nowPlus(600)
    );
    setStatus(addLpStatus, "Tx: " + tx.hash);
    await tx.wait();

    setStatus(addLpStatus, "✅ Liquidity added.");
    await updateBalances();
    await updateLpBalance();
  } catch (e) {
    console.error("addLiquidity", e);
    setStatus(
      addLpStatus,
      "❌ " +
        (e.reason || e.data?.message || e.message || "Add LP failed / execution reverted")
    );
  }
};

// ==== REMOVE LIQUIDITY 100% ====
removeLpButton.onclick = async () => {
  if (!signer || !userAddress) {
    alert("Connect wallet dulu.");
    return;
  }
  try {
    const lpBal = await pair.balanceOf(userAddress);
    if (lpBal.isZero()) {
      setStatus(removeLpStatus, "LP balance 0.");
      return;
    }

    setStatus(removeLpStatus, "⏳ Approve LP token...");
    const pairWithSigner = pair.connect(signer);
    const txApprove = await pairWithSigner.approve(
      ROUTER_ADDRESS,
      lpBal
    );
    await txApprove.wait();

    setStatus(removeLpStatus, "🔥 Removing liquidity...");
    const tx = await router.removeLiquidity(
      TOKENS.WGUSDT.address,
      TOKENS.OOPS.address,
      lpBal,
      0,
      0,
      userAddress,
      nowPlus(600)
    );
    setStatus(removeLpStatus, "Tx: " + tx.hash);
    await tx.wait();

    setStatus(removeLpStatus, "✅ Liquidity removed.");
    await updateBalances();
    await updateLpBalance();
  } catch (e) {
    console.error("removeLiquidity", e);
    setStatus(
      removeLpStatus,
      "❌ " +
        (e.reason ||
          e.data?.message ||
          e.message ||
          "Remove LP failed / execution reverted")
    );
  }
};

// ==== INIT UI ====
updateTokenLabels();
swapActionButton.disabled = true;
addLpButton.disabled = true;
removeLpButton.disabled = true;
