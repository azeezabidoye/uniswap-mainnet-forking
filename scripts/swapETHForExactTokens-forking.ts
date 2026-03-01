const helpers = require("@nomicfoundation/hardhat-network-helpers");
import { ethers } from "hardhat";

const main = async () => {
  const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC Real-world address
  const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH -> contract address for Ether cos Ether doesn't have any address
  const UNIRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // UniSwap Router Address
  const TokenHolder = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621"; // Ethereum Whale Address -> Real EOA with Real money

  await helpers.impersonateAccount(TokenHolder); // NomicLab Helper processes the EOA
  const impersonatedSigner = await ethers.getSigner(TokenHolder); // Variable for the EOA to sign transactions

  const USDC = await ethers.getContractAt(
    "IERC20",
    USDCAddress,
    impersonatedSigner,
  );

  const UniRouterContract = await ethers.getContractAt(
    "IUniswapV2Router",
    UNIRouter,
    impersonatedSigner,
  );

  // Amount expected from UniSwap after the process
  const amountOut = ethers.parseUnits("1000", 6);

  // Array of address for both ETH & the other Token
  const path = [WETHAddress, USDCAddress];

  // Minutes expected to process
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  // Balance of other Token before Swapping process
  const usdcBalanceBefore = await USDC.balanceOf(impersonatedSigner);

  // ETH balance before swapping
  // Coming from an ETH Account...not wallet
  // That's why getBalance() method is used
  const wethBalanceBefore = await ethers.provider.getBalance(
    impersonatedSigner,
  );

  console.log("=======Before============");

  console.log("weth balance before", Number(wethBalanceBefore));
  console.log("usdc balance before", Number(usdcBalanceBefore));

  // The SWAPPING Process
  const transaction = await UniRouterContract.swapETHForExactTokens(
    amountOut,
    path,
    impersonatedSigner,
    deadline,
    {
      value: ethers.parseEther("0.7"),
    },
  );

  // Calls Swap process function
  await transaction.wait();

  console.log("=======After============");
  const usdcBalanceAfter = await USDC.balanceOf(impersonatedSigner);
  const wethBalanceAfter = await ethers.provider.getBalance(impersonatedSigner);
  console.log("weth balance after", Number(wethBalanceAfter));
  console.log("usdc balance after", Number(usdcBalanceAfter));

  console.log("=========Difference==========");
  const newUsdcValue = Number(usdcBalanceAfter - usdcBalanceBefore);
  const newWethValue = wethBalanceBefore - wethBalanceAfter;
  console.log("NEW USDC BALANCE: ", ethers.formatUnits(newUsdcValue, 6));
  console.log("NEW WETH BALANCE: ", ethers.formatEther(newWethValue));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
