const helpers = require("@nomicfoundation/hardhat-network-helpers");
import { ethers } from "hardhat";

const main = async () => {
  const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; //
  const DAIAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const UNIRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const USDCHolder = "0xf584f8728b874a6a5c7a8d4d387c9aae9172d621"; // Real EOA with USDC token

  await helpers.impersonateAccount(USDCHolder); //1
  const impersonatedSigner = await ethers.getSigner(USDCHolder); //2

  const amountUSDC = ethers.parseUnits("10000", 6); // 1000 * 10^6 ==> 10_000_000_000 wei
  const amountDAI = ethers.parseUnits("10000", 18); // Amount inteded to be swapped
  const amountUSDCMin = ethers.parseUnits("9000", 6); // Minimum amount expected after...
  const amountDAIMin = ethers.parseUnits("9000", 18); // ...swapping if there's Slippage Tolerance
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

  // Calling the approve() fn from IERC20 on our two tokens
  await USDC.approve(UNIRouter, amountUSDC);
  await DAI.approve(UNIRouter, amountDAI);

  // This gets the balance of the Impersonated signer BEFORE adding liquidity
  const usdcBalBefore = await USDC.balanceOf(impersonatedSigner.address);
  const daiBalBefore = await DAI.balanceOf(impersonatedSigner.address);
  console.log(
    "=================Before========================================",
  );

  console.log("USDC Balance before adding liquidity:", Number(usdcBalBefore));
  console.log("DAI Balance before adding liquidity:", Number(daiBalBefore));

  // Calling the AddLiquidity Function on Uniswap Router
  // Variables defined above serves as args
  const tx = await ROUTER.addLiquidity(
    USDCAddress,
    DAIAddress,
    amountUSDC,
    amountDAI,
    amountUSDCMin,
    amountDAIMin,
    impersonatedSigner.address,
    deadline,
  );

  // Processes the transaction
  await tx.wait();

  // This gets the balance of the Impersonated signer AFTER adding liquidity
  const usdcBalAfter = await USDC.balanceOf(impersonatedSigner.address);
  const daiBalAfter = await DAI.balanceOf(impersonatedSigner.address);
  console.log("=================After========================================");
  console.log("USDC Balance after adding liquidity:", Number(usdcBalAfter));
  console.log("DAI Balance after adding liquidity:", Number(daiBalAfter));

  console.log("Liquidity added successfully!");
  console.log("=========================================================");

  // Calculates the difference btw the Balances...
  // ...provided BEFORE and AFTER adding liquidity
  // We get to know how much profit or loss
  const usdcUsed = usdcBalBefore - usdcBalAfter;
  const daiUsed = daiBalBefore - daiBalAfter;

  // Logs the diff-in-Balance and uses formatUnits() method to convert Wei to actual value
  console.log("USDC USED:", ethers.formatUnits(usdcUsed, 6));
  console.log("DAI USED:", ethers.formatUnits(daiUsed, 18));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
