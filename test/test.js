const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const provider = waffle.provider;
const opolisDest = "0x7136fbDdD4DFfa2369A9283B6E90A040318011Ca";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const nonWhitelistedToken = (newAddress =
  "0x2DaA35962A6D43EB54C48367b33d0B379C930E5e");

describe("payroll works", function () {
  let testToken;
  let payroll;
  let opolisAdmin;
  let opolisHelper;
  let opolisMember1;
  let opolisMember2;

  const payrollID1 = 001;
  const payrollID2 = 002;

  const payrollAmt1 = ethers.utils.parseUnits("2500", 18);
  const payrollAmt2 = ethers.utils.parseUnits("3000", 18);

  const stakeApproval = ethers.utils.parseUnits("100000", 18);


  let setupTx;

  beforeEach(async () => {
    const TestToken = await ethers.getContractFactory("TestToken");
    const OpolisPay = await ethers.getContractFactory("OpolisPay");
    [opolisAdmin, opolisHelper, opolisMember1, opolisMember2] =
      await ethers.getSigners();

    testToken = await TestToken.deploy();
    await testToken.deployed();

    testToken2 = await TestToken.deploy();
    await testToken2.deployed();

    testToken3 = await TestToken.deploy();
    await testToken3.deployed();

    payroll = await OpolisPay.deploy(
      opolisDest,
      opolisAdmin.address,
      opolisHelper.address,
      [testToken.address]
    );
    await payroll.deployed();
  });

  describe("contract setup", () => {
    it("Setup should be done correctly", async function () {
      expect(payroll.deployTransaction)
        .to.emit(payroll, "SetupComplete")
        .withArgs(opolisDest, opolisAdmin.address, opolisHelper.address, [
          testToken.address,
        ]);
    });

    it("Can't send eth directly to contract", async () => {
      await expect(
        opolisMember1.sendTransaction({
          to: payroll.address,
          value: ethers.utils.parseEther("1.0"),
        })
      ).to.be.revertedWith("DirectTransfer()");
    });
  });

  describe("pay payroll", () => {
    let payment;

    beforeEach(async () => {
      await testToken.mint(opolisMember1.address, payrollAmt1);
      await testToken
        .connect(opolisMember1)
        .approve(payroll.address, payrollAmt1);
      payment = await payroll
        .connect(opolisMember1)
        .payPayroll(testToken.address, payrollAmt1, payrollID1);
    });

    it("No duplicate payroll ids", async function () {
      await expect(
        payroll
          .connect(opolisMember1)
          .payPayroll(testToken.address, payrollAmt1, payrollID1)
      ).to.be.revertedWith("DuplicatePayroll()");
    });

    it("Lets you pay payroll with correct inputs", async function () {
      expect(payment)
        .to.emit(payroll, "Paid")
        .withArgs(
          opolisMember1.address,
          testToken.address,
          payrollID1,
          payrollAmt1
        );
    });

    it("Requires you pay with a whitelisted token", async function () {
      await expect(
        payroll
          .connect(opolisMember1)
          .payPayroll(nonWhitelistedToken, payrollAmt1, payrollID1)
      ).to.be.revertedWith("NotWhitelisted()");
    });

    it("Requires you to send a payroll amount above 0", async function () {
      await expect(
        payroll
          .connect(opolisMember1)
          .payPayroll(testToken.address, payrollAmt1, 0)
      ).to.be.revertedWith("InvalidPayroll()");
    });
  });

  describe("stake", () => {
    beforeEach(async () => {
      await testToken.mint(opolisMember1.address, stakeApproval);
      await testToken
        .connect(opolisMember1)
        .approve(payroll.address, stakeApproval);
    });

    it("Let's a member stake multiple times", async function () {
      await payroll
        .connect(opolisMember1)
        .memberStake(testToken.address, payrollAmt1, payrollID1);
      await expect(
        payroll
          .connect(opolisMember1)
          .memberStake(testToken.address, payrollAmt2, payrollID1)
      ).to.emit(payroll, "Staked")
      .withArgs(
        opolisMember1.address,
        testToken.address,
        payrollAmt2,
        payrollID1,
        2
      );
    });

    it("Let's you stake with correct inputs", async function () {
      const stake = await payroll
        .connect(opolisMember1)
        .memberStake(testToken.address, payrollAmt1, payrollID1);
      expect(stake)
        .to.emit(payroll, "Staked")
        .withArgs(
          opolisMember1.address,
          testToken.address,
          payrollAmt1,
          payrollID1,
          1
        );
    });

    it("Requires you pay with a whitelisted token or ETH", async function () {
      await expect(
        payroll
          .connect(opolisMember1)
          .memberStake(nonWhitelistedToken, payrollAmt1, payrollID1)
      ).to.be.revertedWith("InvalidStake()");

      const stake = await payroll
        .connect(opolisMember1)
        .memberStake(ethAddress, payrollAmt1, payrollID1, {
          value: ethers.utils.parseEther("1.0"),
        });
      expect(stake)
        .to.emit(payroll, "Staked")
        .withArgs(opolisMember1.address, ethAddress, ethers.utils.parseEther("1.0").toString(), payrollID1, 1);

      const ethBalance = await provider.getBalance(opolisDest);
      expect(ethBalance.eq(ethers.utils.parseEther("1.0"))).to.be.true;
    });

    it("Requires you stake with a memberId", async function () {
      await expect(
        payroll
          .connect(opolisMember1)
          .memberStake(testToken.address, payrollAmt1, 0)
      ).to.be.revertedWith("NotMember()");
    });

    it("Requires you to stake with an amount over 0", async function () {
      await expect(
        payroll
          .connect(opolisMember1)
          .memberStake(testToken.address, 0, payrollID1)
      ).to.be.revertedWith("InvalidStake()");
      await expect(
        payroll
          .connect(opolisMember1)
          .memberStake(zeroAddress, payrollAmt1, payrollID1, {
            value: ethers.utils.parseEther("0"),
          })
      ).to.be.revertedWith("InvalidStake()");
    });
  });

  describe("admin accounting functions", () => {
    beforeEach(async () => {
      await testToken.mint(opolisMember1.address, payrollAmt1);
      await testToken
        .connect(opolisMember1)
        .approve(payroll.address, payrollAmt1);
      await payroll
        .connect(opolisMember1)
        .payPayroll(testToken.address, payrollAmt1, payrollID1);
    });

    it("Can't withdraw non whitelisted token", async function () {
      await expect(
        payroll.withdrawPayrolls(
          [payrollID1],
          [testToken2.address],
          [payrollAmt1]
        )
      ).to.be.revertedWith("InvalidToken()");

      // stake
      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await payroll
        .connect(opolisMember2)
        .memberStake(testToken.address, payrollAmt2, payrollID2);
      await expect(
        payroll.withdrawStakes(
          [payrollID2],
          [1],
          [testToken2.address],
          [payrollAmt2]
        )
      ).to.be.revertedWith("InvalidToken()");
    });

    it("Can't withdraw non existant payroll", async function () {
      await expect(
        payroll.withdrawPayrolls(
          [payrollID2],
          [testToken.address],
          [payrollAmt1]
        )
      ).to.be.revertedWith("InvalidPayroll()");
    });

    it("Can't pass wrong stake arrays", async function () {
      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await payroll
        .connect(opolisMember2)
        .memberStake(testToken.address, payrollAmt2, payrollID2);
      await expect(
        payroll.withdrawStakes([payrollID1], [1,3,4], [testToken.address], [payrollAmt2])
      ).to.be.revertedWith("InvalidWithdraw()");
    });

    it("Can withdraw one payroll", async function () {
      const withdrawTx = await payroll.withdrawPayrolls(
        [payrollID1],
        [testToken.address],
        [payrollAmt1]
      );
      expect(withdrawTx)
        .to.emit(payroll, "OpsPayrollWithdraw")
        .withArgs(testToken.address, payrollID1, payrollAmt1);
    });

    it("Can withdraw more than one payrolls", async function () {
      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await payroll
        .connect(opolisMember2)
        .payPayroll(testToken.address, payrollAmt2, payrollID2);

      const withdrawTx = await payroll.withdrawPayrolls(
        [payrollID1, payrollID2],
        [testToken.address, testToken.address],
        [payrollAmt1, payrollAmt2]
      );
      expect(withdrawTx)
        .to.emit(payroll, "OpsPayrollWithdraw")
        .withArgs(testToken.address, payrollID1, payrollAmt1);
      expect(withdrawTx)
        .to.emit(payroll, "OpsPayrollWithdraw")
        .withArgs(testToken.address, payrollID2, payrollAmt2);
    });

    it("withdraw lots of payrolls with multiple tokens at the same time", async function () {
      await payroll.addTokens([testToken2.address, testToken3.address]);
      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken2.mint(opolisMember2.address, payrollAmt2);
      await testToken3.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await testToken2
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await testToken3
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);

      let ids = [];
      let tokens = [];
      let amounts = [];
      for (let i = 10; i < 150; i++) {
        await payroll
          .connect(opolisMember2)
          .payPayroll(testToken.address, "1", i);

        ids = [...ids, i];
        tokens = [...tokens, testToken.address];
        amounts = [...amounts, "1"];
      }
      for (let i = 150; i < 300; i++) {
        await payroll
          .connect(opolisMember2)
          .payPayroll(testToken2.address, "1", i);

        ids = [...ids, i];
        tokens = [...tokens, testToken2.address];
        amounts = [...amounts, "1"];
      }
      for (let i = 300; i < 500; i++) {
        await payroll
          .connect(opolisMember2)
          .payPayroll(testToken3.address, "1", i);

        ids = [...ids, i];
        tokens = [...tokens, testToken3.address];
        amounts = [...amounts, "1"];
      }

      const withdrawTx = await payroll.withdrawPayrolls(ids, tokens, amounts);
      expect(withdrawTx)
        .to.emit(payroll, "OpsPayrollWithdraw")
        .withArgs(testToken.address, 10, "1");
    });

    it("Cannot withdraw a payroll thats already withdrawn", async function () {
      const startBalance = await testToken.balanceOf(payroll.address);
      await payroll.withdrawPayrolls(
        [payrollID1],
        [testToken.address],
        [payrollAmt1]
      );
      const midBalance = await testToken.balanceOf(payroll.address);
      await payroll.withdrawPayrolls(
        [payrollID1],
        [testToken.address],
        [payrollAmt1]
      );
      const endBalance = await testToken.balanceOf(payroll.address);
      expect(startBalance.gt(midBalance)).to.equal(true);
      expect(midBalance.toString()).to.equal(endBalance.toString());
    });

    it("Can withdraw more than one stake", async function () {
      await testToken.mint(opolisMember1.address, payrollAmt1);
      await testToken
        .connect(opolisMember1)
        .approve(payroll.address, payrollAmt1);
      await payroll
        .connect(opolisMember1)
        .memberStake(testToken.address, payrollAmt1, payrollID1);

      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await payroll
        .connect(opolisMember2)
        .memberStake(testToken.address, payrollAmt2, payrollID2);

      const withdrawTx = await payroll.withdrawStakes(
        [payrollID1, payrollID2],
        [1,1],
        [testToken.address, testToken.address],
        [payrollAmt1, payrollAmt2]
      );
      expect(withdrawTx)
        .to.emit(payroll, "OpsStakeWithdraw")
        .withArgs(testToken.address, payrollID1, 1, payrollAmt1);
      expect(withdrawTx)
        .to.emit(payroll, "OpsStakeWithdraw")
        .withArgs(testToken.address, payrollID2, 1, payrollAmt2);
    });

    it("Cannot withdraw a stake thats already withdrawn", async function () {
      await testToken.mint(opolisMember1.address, payrollAmt1);
      await testToken
        .connect(opolisMember1)
        .approve(payroll.address, payrollAmt1);
      await payroll
        .connect(opolisMember1)
        .memberStake(testToken.address, payrollAmt1, payrollID1);

      const startBalance = await testToken.balanceOf(payroll.address);
      await payroll.withdrawStakes(
        [payrollID1],
        [1],
        [testToken.address],
        [payrollAmt1]
      );
      const midBalance = await testToken.balanceOf(payroll.address);
      await payroll.withdrawStakes(
        [payrollID1],
        [1],
        [testToken.address],
        [payrollAmt1]
      );
      const endBalance = await testToken.balanceOf(payroll.address);
      expect(startBalance.gt(midBalance)).to.equal(true);
      expect(midBalance.toString()).to.equal(endBalance.toString());
    });

    it("withdraw lots of stakes with multiple tokens at the same time", async function () {
      await payroll.addTokens([testToken2.address, testToken3.address]);
      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken2.mint(opolisMember2.address, payrollAmt2);
      await testToken3.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await testToken2
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await testToken3
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);

      let ids = [];
      let nums = [];
      let tokens = [];
      let amounts = [];
      for (let i = 1; i < 150; i++) {
        await payroll
          .connect(opolisMember2)
          .memberStake(testToken.address, "1", i);

        ids = [...ids, i];
        nums = [...nums, 1]
        tokens = [...tokens, testToken.address];
        amounts = [...amounts, "1"];
      }
      for (let i = 150; i < 300; i++) {
        await payroll
          .connect(opolisMember2)
          .memberStake(testToken2.address, "1", i);

        ids = [...ids, i];
        nums = [...nums, 1]
        tokens = [...tokens, testToken2.address];
        amounts = [...amounts, "1"];
      }
      for (let i = 300; i < 450; i++) {
        await payroll
          .connect(opolisMember2)
          .memberStake(testToken3.address, "1", i);

        ids = [...ids, i];
        nums = [...nums, 1]
        tokens = [...tokens, testToken3.address];
        amounts = [...amounts, "1"];
      }

      const withdrawTx = await payroll.withdrawStakes(ids, nums, tokens, amounts);
      expect(withdrawTx)
        .to.emit(payroll, "OpsStakeWithdraw")
        .withArgs(testToken.address, 1, 1, "1");
    });

    it("Can clear balance if admin'", async function () {
      await testToken.mint(opolisMember2.address, payrollAmt2);
      await testToken
        .connect(opolisMember2)
        .approve(payroll.address, payrollAmt2);
      await payroll
        .connect(opolisMember2)
        .payPayroll(testToken.address, payrollAmt2, payrollID2);

      expect((await testToken.balanceOf(payroll.address)).toString()).to.equal(
        payrollAmt1.add(payrollAmt2).toString()
      );
      await payroll.clearBalance();
      expect(Number(await testToken.balanceOf(payroll.address))).to.equal(0);
    });
  });

  describe("Admin update parameter functions", () => {
    it("valid destination, admin, helper addresses", async () => {
      await expect(payroll.updateDestination(zeroAddress)).to.be.revertedWith(
        "ZeroAddress()"
      );
      await expect(payroll.updateAdmin(zeroAddress)).to.be.revertedWith(
        "ZeroAddress()"
      );
      await expect(payroll.updateHelper(zeroAddress)).to.be.revertedWith(
        "ZeroAddress()"
      );
    });

    it("onlyAdmin", async () => {
      await expect(
        payroll.connect(opolisMember1).updateDestination(newAddress)
      ).to.be.revertedWith("NotPermitted()");
      await expect(
        payroll.connect(opolisMember1).updateAdmin(newAddress)
      ).to.be.revertedWith("NotPermitted()");
      await expect(
        payroll.connect(opolisMember1).updateHelper(newAddress)
      ).to.be.revertedWith("NotPermitted()");
      await expect(
        payroll.connect(opolisMember1).addTokens([newAddress])
      ).to.be.revertedWith("NotPermitted()");
      await expect(
        payroll.connect(opolisMember1).clearBalance()
      ).to.be.revertedWith("NotPermitted()");
    });

    it("update destination", async () => {
      const tx = await payroll.updateDestination(newAddress);
      expect(tx)
        .to.emit(payroll, "NewDestination")
        .withArgs(opolisDest, newAddress);
    });

    it("update admin", async () => {
      const tx = await payroll.updateAdmin(newAddress);
      expect(tx)
        .to.emit(payroll, "NewAdmin")
        .withArgs(opolisAdmin.address, newAddress);
    });

    it("update helper", async () => {
      const tx = await payroll.updateHelper(newAddress);
      expect(tx)
        .to.emit(payroll, "NewHelper")
        .withArgs(opolisHelper.address, newAddress);
    });

    it("add tokens", async () => {
      const tokens = [
        "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
        "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      ];
      const tx = await payroll.addTokens(tokens);
      expect(tx).to.emit(payroll, "NewTokens").withArgs(tokens);
    });
  });
});
