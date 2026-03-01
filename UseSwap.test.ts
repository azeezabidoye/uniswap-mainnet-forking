import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { UseSwap } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal mock ABI fragments used by the fake router & token
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ROUTER_ABI = [
  `function swapETHForExactTokens(
      uint amountOut,
      address[] calldata path,
      address to,
      uint deadline
   ) external payable returns (uint[] memory amounts)`,
  `function WETH() external pure returns (address)`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: deploy a minimal mock UniswapV2Router using an inline Solidity string
// ─────────────────────────────────────────────────────────────────────────────
async function deployMockRouter(wethAddress: string) {
  const MockRouter = await ethers.getContractFactory("MockUniswapV2Router");
  const router = await MockRouter.deploy(wethAddress);
  await router.waitForDeployment();
  return router;
}

async function deployMockERC20(name: string, symbol: string) {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy(name, symbol, ethers.parseEther("1000000"));
  await token.waitForDeployment();
  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────
describe("UseSwap – swapETHForExactTokens", function () {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let recipient: SignerWithAddress;

  let useSwap: UseSwap;
  let mockRouter: Awaited<ReturnType<typeof deployMockRouter>>;
  let weth: Awaited<ReturnType<typeof deployMockERC20>>;
  let tokenOut: Awaited<ReturnType<typeof deployMockERC20>>;

  const DEADLINE = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  beforeEach(async () => {
    [owner, user, recipient] = await ethers.getSigners();

    // Deploy mock WETH & output token
    weth = await deployMockERC20("Wrapped Ether", "WETH");
    tokenOut = await deployMockERC20("DAI Stablecoin", "DAI");

    // Deploy mock router; seed it with tokenOut so it can fulfil swaps
    mockRouter = await deployMockRouter(await weth.getAddress());
    await tokenOut.transfer(
      await mockRouter.getAddress(),
      ethers.parseEther("500000")
    );

    // Deploy UseSwap pointing at the mock router
    const UseSwapFactory = await ethers.getContractFactory("UseSwap");
    useSwap = (await UseSwapFactory.deploy(
      await mockRouter.getAddress()
    )) as UseSwap;
    await useSwap.waitForDeployment();
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  it("should execute a swap and increment swapETHCount", async () => {
    const amountOut = ethers.parseEther("100"); // want 100 DAI
    const ethToSend = ethers.parseEther("1"); // send 1 ETH

    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    const countBefore = await useSwap.swapETHCount();

    await useSwap
      .connect(user)
      .swapETHForExactTokens(amountOut, path, recipient.address, DEADLINE, {
        value: ethToSend,
      });

    const countAfter = await useSwap.swapETHCount();
    expect(countAfter).to.equal(countBefore + 1n);
  });

  it("should deliver the exact amountOut of tokens to the recipient", async () => {
    const amountOut = ethers.parseEther("50");
    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    const balanceBefore = await tokenOut.balanceOf(recipient.address);

    await useSwap
      .connect(user)
      .swapETHForExactTokens(amountOut, path, recipient.address, DEADLINE, {
        value: ethers.parseEther("1"),
      });

    const balanceAfter = await tokenOut.balanceOf(recipient.address);
    expect(balanceAfter - balanceBefore).to.equal(amountOut);
  });

  it("should return the amounts array from the router", async () => {
    const amountOut = ethers.parseEther("10");
    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    const amounts = await useSwap
      .connect(user)
      .swapETHForExactTokens.staticCall(
        amountOut,
        path,
        recipient.address,
        DEADLINE,
        { value: ethers.parseEther("1") }
      );

    // amounts[last] must equal amountOut
    expect(amounts[amounts.length - 1]).to.equal(amountOut);
  });

  // ── 2. ETH refund ─────────────────────────────────────────────────────────
  it("should refund excess ETH to the sender via the router", async () => {
    const amountOut = ethers.parseEther("10");
    const path = [await weth.getAddress(), await tokenOut.getAddress()];
    const ethToSend = ethers.parseEther("2"); // overpay

    const balanceBefore = await ethers.provider.getBalance(user.address);

    const tx = await useSwap
      .connect(user)
      .swapETHForExactTokens(amountOut, path, recipient.address, DEADLINE, {
        value: ethToSend,
      });
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

    const balanceAfter = await ethers.provider.getBalance(user.address);

    // The router mock charges exactly (amountOut / 1e18) * 0.01 ETH per token (see mock impl).
    // We just assert that the user spent LESS than the full ethToSend (minus gas).
    expect(balanceBefore - balanceAfter - gasUsed).to.be.lt(ethToSend);
  });

  // ── 3. Revert cases ───────────────────────────────────────────────────────
  it("should revert if no ETH is sent", async () => {
    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    await expect(
      useSwap
        .connect(user)
        .swapETHForExactTokens(
          ethers.parseEther("10"),
          path,
          recipient.address,
          DEADLINE,
          { value: 0 }
        )
    ).to.be.revertedWith("UseSwap: must send ETH");
  });

  it("should revert if path length is less than 2", async () => {
    await expect(
      useSwap
        .connect(user)
        .swapETHForExactTokens(
          ethers.parseEther("10"),
          [await weth.getAddress()], // only one element
          recipient.address,
          DEADLINE,
          { value: ethers.parseEther("1") }
        )
    ).to.be.revertedWith("UseSwap: invalid path");
  });

  it("should revert when the deadline has passed", async () => {
    const expiredDeadline = Math.floor(Date.now() / 1000) - 60; // 1 min ago
    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    await expect(
      useSwap
        .connect(user)
        .swapETHForExactTokens(
          ethers.parseEther("10"),
          path,
          recipient.address,
          expiredDeadline,
          { value: ethers.parseEther("1") }
        )
    ).to.be.revertedWith("MockRouter: EXPIRED");
  });

  it("should revert when ETH sent is insufficient for the requested amountOut", async () => {
    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    // The mock requires 0.01 ETH per token; 1000 tokens = 10 ETH, but we send only 0.001 ETH
    await expect(
      useSwap
        .connect(user)
        .swapETHForExactTokens(
          ethers.parseEther("1000"),
          path,
          recipient.address,
          DEADLINE,
          { value: ethers.parseEther("0.001") }
        )
    ).to.be.revertedWith("MockRouter: INSUFFICIENT_ETH");
  });

  // ── 4. State isolation ────────────────────────────────────────────────────
  it("should not affect swapCount or swapCountToken", async () => {
    const path = [await weth.getAddress(), await tokenOut.getAddress()];

    await useSwap
      .connect(user)
      .swapETHForExactTokens(
        ethers.parseEther("10"),
        path,
        recipient.address,
        DEADLINE,
        { value: ethers.parseEther("1") }
      );

    expect(await useSwap.swapCount()).to.equal(0n);
    expect(await useSwap.swapCountToken()).to.equal(0n);
    expect(await useSwap.swapETHCount()).to.equal(1n);
  });

  // ── 5. Multi-hop path ─────────────────────────────────────────────────────
  it("should work with a multi-hop path (WETH → Token1 → Token2)", async () => {
    const intermediateToken = await deployMockERC20("Intermediate", "INT");
    await tokenOut.transfer(
      await mockRouter.getAddress(),
      ethers.parseEther("100000")
    );

    const path = [
      await weth.getAddress(),
      await intermediateToken.getAddress(),
      await tokenOut.getAddress(),
    ];

    const amountOut = ethers.parseEther("5");

    // Should not revert; router mock ignores intermediate hops
    await expect(
      useSwap
        .connect(user)
        .swapETHForExactTokens(amountOut, path, recipient.address, DEADLINE, {
          value: ethers.parseEther("1"),
        })
    ).to.not.be.reverted;

    expect(await useSwap.swapETHCount()).to.equal(1n);
  });
});
