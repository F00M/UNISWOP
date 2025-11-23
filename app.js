// ====== ADDRESSES ======
const gUSDT  = "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6"; // native
const wGUSDT = "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6"; // wrapped
const OOPS   = "0xB0CBCcEe94c957Fa21A97551C825C4e71ADfF93D";
const ROUTER = "0xe1aEe57F48830876B37A1a7d04d73eF9F1d069f2";
const WRAPPER = "0xfDb4190419F2b0453Dad7567dEF44E6AB07096c6"; // wgUSDT contract

// ====== ABIs ======
const erc20 = [
  "function approve(address,uint256) external returns(bool)",
  "function balanceOf(address) view returns(uint256)"
];

const routerABI = [
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address tokenIn,address tokenOut,address to) external returns (uint)"
];

const wrapperABI = [
  "function deposit() external payable",
  "function withdraw(uint amount) external"
];

// ====== CONNECT ======
let provider, signer, user;

document.getElementById("connectBtn").onclick = async () => {
  await ethereum.request({ method: "eth_requestAccounts" });
  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer   = provider.getSigner();
  user     = await signer.getAddress();
  document.getElementById("swapBtn").disabled = false;
};

// ====== MAIN ACTION ======
document.getElementById("swapBtn").onclick = async () => {
  const amount = ethers.utils.parseUnits(
    document.getElementById("swapInput").value,
    18
  );

  const fromToken = "wGUSDT"; // UI token top
  const toToken   = "OOPS";   // UI token bottom

  const wrapper = new ethers.Contract(WRAPPER, wrapperABI, signer);
  const router  = new ethers.Contract(ROUTER, routerABI, signer);

  // ===== WRAP =====
  if (fromToken === "gUSDT" && toToken === "wGUSDT") {
    const tx = await wrapper.deposit({ value: amount });
    await tx.wait();
    return;
  }

  // ===== UNWRAP =====
  if (fromToken === "wGUSDT" && toToken === "gUSDT") {
    const tx = await wrapper.withdraw(amount);
    await tx.wait();
    return;
  }

  // ===== NORMAL SWAP =====
  const token = new ethers.Contract(wGUSDT, erc20, signer);
  await token.approve(ROUTER, amount);

  const tx = await router.swapExactTokensForTokens(
    amount,
    0,
    wGUSDT,
    OOPS,
    user
  );

  await tx.wait();
};
