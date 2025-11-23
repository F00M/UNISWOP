// ====== CONTRACT ADDRESSES (REAL ON-CHAIN) ======
const WGSUTD = "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6";
const OOPS    = "0xB0CBCcEe94c957Fa21A97551C825C4e71ADfF93D";
const ROUTER  = "0xe1aEe57F48830876B37A1a7d04d73eF9F1d069f2";
const PAIR    = "0xc5D2b0D1b6BAe03571dF97D6f389AB47Af7a0d30";

// ====== ABIs ======
const routerABI = [
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address tokenIn,address tokenOut,address to) external returns (uint)"
];

const erc20ABI = [
  "function balanceOf(address) view returns (uint)",
  "function approve(address spender,uint amount) external returns (bool)"
];

const pairABI = [
  "function getReserves() view returns (uint112,uint112,uint32)"
];

// ====== UI ELEMENTS ======
const connectBtn = document.getElementById("connectBtn");
const wrapBtn    = document.getElementById("wrapBtn");
const unwrapBtn  = document.getElementById("unwrapBtn");
const swapBtn    = document.getElementById("swapBtn");
const swapInput  = document.getElementById("swapInput");
const statusEl   = document.getElementById("status");

let provider, signer, user;

// ====== LOG OUTPUT ======
function log(msg) {
  statusEl.textContent = msg;
}

// ====== CONNECT WALLET ======
connectBtn.onclick = async () => {
  await window.ethereum.request({ method: "eth_requestAccounts" });
  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer   = provider.getSigner();
  user     = await signer.getAddress();

  swapBtn.disabled = false;
  wrapBtn.disabled = false;
  unwrapBtn.disabled = false;

  log(`✅ Wallet connected:\n${user}`);
};

// ====== GET PRICE ESTIMATE ======
async function getEstimatedOut(amountIn) {
  const pair = new ethers.Contract(PAIR, pairABI, provider);
  const [r0, r1] = await pair.getReserves();

  // FIXED: wGUSDT = token0, OOPS = token1
  const reserveIn  = r0;
  const reserveOut = r1;

  const amountInWithFee = amountIn * 997n;
  const num  = amountInWithFee * reserveOut;
  const den  = reserveIn * 1000n + amountInWithFee;
  return num / den;
}

// ====== LIVE OUTPUT UPDATE ======
swapInput.oninput = async () => {
  if (!swapInput.value) return;
  const amountIn = BigInt(ethers.utils.parseUnits(swapInput.value, 18));
  const out      = await getEstimatedOut(amountIn);
  log(`Estimated output: ${ethers.utils.formatUnits(out,18)} OOPS`);
};

// ====== SWAP ======
swapBtn.onclick = async () => {
  try {
    const amountIn = ethers.utils.parseUnits(swapInput.value, 18);

    const token = new ethers.Contract(WGSUTD, erc20ABI, signer);
    await token.approve(ROUTER, amountIn);

    const router = new ethers.Contract(ROUTER, routerABI, signer);

    const tx = await router.swapExactTokensForTokens(
      amountIn,
      0,
      WGSUTD,
      OOPS,
      user
    );

    log(`⏳ Swap sent: ${tx.hash}`);
    await tx.wait();
    log(`🎉 Swap SUCCESS — OOPS received!`);

  } catch (err) {
    log(`❌ Error: ${err.message}`);
  }
};
