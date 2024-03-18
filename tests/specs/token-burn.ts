import { DigitalAsset } from "@metaplex-foundation/mpl-token-metadata"
import { fetchMint } from "@metaplex-foundation/mpl-toolbox"
import { generateSigner, KeypairSigner, PublicKey, tokenAmount } from "@metaplex-foundation/umi"
import { assert } from "chai"
import { createNewUser, randomnessService } from "../helper"
import { createRaffle, buyTicketsToken, settleRaffle, claimPrize, createRaffloor } from "../helpers/instructions"
import { findRafflePda, getTokenAccount } from "../helpers/pdas"
import { umi } from "../helpers/umi"
import { expectFail, assertErrorCode, sleep, getTokenAmount, getEntrantsArray, TX_FEE } from "../helpers/utils"
import { createNft } from "../helpers/create-nft"
import { createToken } from "../helpers/create-token"

describe("Token burn raffle", () => {
  let prize: DigitalAsset
  let tokenMint: PublicKey
  let authority: KeypairSigner
  let raffler: PublicKey
  let user: KeypairSigner
  const treasury = generateSigner(umi).publicKey

  before(async () => {
    user = await createNewUser()
    ;[authority, raffler] = await createRaffloor("token burn", "token_burn", treasury)
    prize = await createNft(umi, true, undefined, authority.publicKey)
    tokenMint = await createToken(umi, tokenAmount(100_000, "token", 6).basisPoints, 6, undefined, user.publicKey)
  })
  const entrants = generateSigner(umi)
  const raffle = findRafflePda(entrants.publicKey)

  it("can create a token burn raffle, with unlimited entries paid by entrants", async () => {
    await createRaffle({
      prizeType: { nft: {} },
      authority,
      raffler,
      entrants,
      prize: prize.publicKey,
      tokenMint,
      ticketPrice: tokenAmount(0.01, "token", 6).basisPoints,
      startTime: Date.now() / 1000 + 1,
      numTickets: null,
      entryType: {
        burn: {
          witholdBurnProceeds: false,
        },
      },
      duration: 4,
    })

    const tokenAccExists = await umi.rpc.accountExists(getTokenAccount(tokenMint, treasury))
    assert.ok(tokenAccExists, "Expected token account to be created in treasury")
  })

  it("cannot buy tickets before the raffle has started", async () => {
    await expectFail(
      () => buyTicketsToken(user, raffle, 1),
      (err) => assertErrorCode(err, "NotStarted")
    )
  })

  it("can wait 3 secs and buy a ticket", async () => {
    await sleep(3000)
    const balanceBefore = await umi.rpc.getBalance(user.publicKey)
    const tokenBalanceBefore = await getTokenAmount(tokenMint, user.publicKey)
    const tokenSupplyBefore = (await fetchMint(umi, tokenMint)).supply
    await buyTicketsToken(user, raffle, 1)
    const balanceAfter = await umi.rpc.getBalance(user.publicKey)
    const tokenBalanceAfter = await getTokenAmount(tokenMint, user.publicKey)
    const tokenSupplyAfter = (await fetchMint(umi, tokenMint)).supply
    const entrantsArray = await getEntrantsArray(entrants.publicKey)
    assert.ok(entrantsArray.includes(user.publicKey), "Expected user to be added to entrants")

    const entrantsAcc = await umi.rpc.getAccount(entrants.publicKey)
    const newRent = await umi.rpc.getRent(entrantsAcc.exists && entrantsAcc.data.length + 32)
    const priceForNewData = newRent.basisPoints - (entrantsAcc.exists && entrantsAcc.lamports.basisPoints)

    assert.equal(
      tokenBalanceBefore - tokenBalanceAfter,
      tokenAmount(0.01, "token", 6).basisPoints,
      "Expected to spend 0.01"
    )

    assert.equal(
      balanceBefore.basisPoints - balanceAfter.basisPoints,
      TX_FEE + priceForNewData,
      "Expected to pay for tx fee and storage of new pubkey"
    )

    assert.equal(
      tokenSupplyBefore - tokenSupplyAfter,
      tokenAmount(0.01, "token", 6).basisPoints,
      "Expected tokens to be burned"
    )
  })

  it("can buy max 320 tickets", async () => {
    const max = Math.floor(10240 / 32)
    const balanceBefore = await umi.rpc.getBalance(user.publicKey)
    const tokenBalanceBefore = await getTokenAmount(tokenMint, user.publicKey)
    await buyTicketsToken(user, raffle, max)
    const balanceAfter = await umi.rpc.getBalance(user.publicKey)
    const tokenBalanceAfter = await getTokenAmount(tokenMint, user.publicKey)
    assert.equal(
      tokenBalanceBefore - tokenBalanceAfter,
      320n * tokenAmount(0.01, "token", 6).basisPoints,
      "expected to have paid for 320 tix"
    )
    const entrantsAcc = await umi.rpc.getAccount(entrants.publicKey)
    const newRent = await umi.rpc.getRent(entrantsAcc.exists && entrantsAcc.data.length + 32)
    const priceForNewData = newRent.basisPoints - (entrantsAcc.exists && entrantsAcc.lamports.basisPoints)

    assert.equal(
      balanceBefore.basisPoints - balanceAfter.basisPoints,
      320n * priceForNewData + TX_FEE,
      "Expected to pay rent for 320 pks"
    )

    const entrantsArray = await getEntrantsArray(entrants.publicKey)
    assert.equal(entrantsArray.length, 321)
  })

  it("can settle the raffle", async () => {
    await sleep(2000)
    await settleRaffle(randomnessService, raffle)
  })

  it("can claim", async () => {
    await claimPrize(user, raffle)
  })
})
