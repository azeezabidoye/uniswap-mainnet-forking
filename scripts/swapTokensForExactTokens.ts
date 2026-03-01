//  swapTokensForExactTokens(
//     uint amountOut,
//     uint amountInMax,
//     address[] calldata path,
//     address to,
//     uint deadline
// );

// amount- out from swap
// amount-in-max -> usdc higher than amountOut
// addresses of usdc & uniswap
// deadline 10 min

const helpers = require("@nomicfoundation/hardhat-network-helpers");
import { ethers } from "hardhat";

const main = async () => {
  const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const UNIRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const USDCHolder = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621";

  await helpers.impersonateAccount(USDCHolder);
  const impersonatedSigner = await ethers.getSigner(USDCHolder);

  const amountInMax = ethers.parseUnits("10000", 6); // amount-in
  const amountOut = ethers.parseUnits("9900", 18); // AmountOutMin
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
  await USDC.approve(UNIRouter, amountInMax);

  // This gets the balance of the Impersonated signer BEFORE swapping
  const usdcBalBefore = await USDC.balanceOf(impersonatedSigner.address);
  const daiBalBefore = await DAI.balanceOf(impersonatedSigner.address);

  console.log(
    "=================Before Swap===================================",
  );
  console.log("USDC Balance before swapping:", Number(usdcBalBefore));

  // Define transaction
  const transaction = await ROUTER.swapTokensForExactTokens(
    amountOut,
    amountInMax,
    path,
    impersonatedSigner.address,
    deadline,
  );

  // Processes txn
  await transaction.wait();

  // This gets the balance of the Impersonated signer AFTER swapping
  const usdcBalAfter = await USDC.balanceOf(impersonatedSigner.address);
  const daiBalAfter = await DAI.balanceOf(impersonatedSigner.address);

  console.log(
    "===========================AFTER SWAP==============================",
  );
  console.log("USDC Balance after swapping:", Number(usdcBalAfter));
  console.log("DAI Balance after swapping:", Number(daiBalAfter));

  console.log("Token Swapped successfully!");
  console.log("=========================================================");
};

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
