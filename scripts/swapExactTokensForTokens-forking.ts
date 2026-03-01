// function swapExactTokensForTokens(
//     uint amountIn,
//     uint amountOutMin,
//     address[] calldata path,
//     address to,
//     uint deadline
// ) external returns (uint[] memory amounts);

// USDC in,
// DAI out
// Array of the two addresses -> contract instances
// ImpersonatedSigner.address
// 10-minutes deadline

const helpers = require("@nomicfoundation/hardhat-network-helpers");
import { ethers } from "hardhat";

const main = async () => {
  const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const UNIRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const USDCHolder = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621";

  await helpers.impersonateAccount(USDCHolder);
  const impersonatedSigner = await ethers.getSigner(USDCHolder);

  const amountUSDC = ethers.parseUnits("10000", 6); // amount-in ->token to be swapped
  const amountDAIMin = ethers.parseUnits("9900", 18); // AmountOutMin -> expected output in another token
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 Minutes

  // Declaring contract instance of USDC token
  const USDC = await ethers.getContractAt(
    "IERC20",
    USDCAddress,
    impersonatedSigner,
  );

  // Declaring contract instance of DAI token
  const DAI = await ethers.getContractAt(
    "IERC20",
    DAIAddress,
    impersonatedSigner,
  );

  // Declaring contract instance of Uniswap Router
  const ROUTER = await ethers.getContractAt(
    "IUniswapV2Router",
    UNIRouter,
    impersonatedSigner,
  );

  // Path: Array of addresses of both token
  const path = [USDCAddress, DAIAddress];

  // Calling the approve() fn from IERC20 on the token
  await USDC.approve(UNIRouter, amountUSDC);

  // This gets the balance of the Impersonated signer BEFORE adding liquidity
  const usdcBalBefore = await USDC.balanceOf(impersonatedSigner.address);
  const daiBalBefore = await DAI.balanceOf(impersonatedSigner.address);

  console.log(
    "=========================Before Swap===========================",
  );
  console.log("USDC Balance before swapping:", Number(usdcBalBefore));
  const transaction = await ROUTER.swapExactTokensForTokens(
    amountUSDC,
    amountDAIMin,
    path,
    impersonatedSigner.address,
    deadline,
  );

  // Processes txn
  await transaction.wait();

  // This gets the balance of the Impersonated signer AFTER swapping
  const usdcBalAfter = await USDC.balanceOf(impersonatedSigner.address);
  const daiBalAfter = await DAI.balanceOf(impersonatedSigner.address);

  console.log("=======================After Swap===========================");
  console.log("USDC Balance after swapping:", Number(usdcBalAfter));
  console.log("DAI Balance after swapping:", Number(daiBalAfter));

  console.log("Token Swapped successfully!");
  console.log("=========================================================");

  // Calculates the difference btw the Balances...
  const usdcUsed = usdcBalBefore - usdcBalAfter;
  const daiUsed = daiBalAfter - daiBalBefore;

  // Logs the diff-in-Balance and uses formatUnits() method to convert Wei to actual value
  console.log("USDC USED:", ethers.formatUnits(usdcUsed, 6));
  console.log("DAI USED:", ethers.formatUnits(daiUsed, 18));
};

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
