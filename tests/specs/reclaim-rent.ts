import * as anchor from "@coral-xyz/anchor"
import { DigitalAsset } from "@metaplex-foundation/mpl-token-metadata"
import { fetchMint } from "@metaplex-foundation/mpl-toolbox"
import { generateSigner, KeypairSigner, PublicKey, sol, tokenAmount } from "@metaplex-foundation/umi"
import { assert } from "chai"
import { createNewUser, programPaidBy, randomnessService } from "../helper"
import { createRaffle, buyTicketsToken, settleRaffle, claimPrize, createRaffloor } from "../helpers/instructions"
import { findRafflePda, getTokenAccount, nativeMint } from "../helpers/pdas"
import { umi } from "../helpers/umi"
import { expectFail, assertErrorCode, sleep, getTokenAmount, getEntrantsArray, TX_FEE } from "../helpers/utils"
import { createNft } from "../helpers/create-nft"
import { createToken } from "../helpers/create-token"

describe.skip("Reclaim rent", () => {
  let prize: DigitalAsset
  let authority: KeypairSigner
  let raffler: PublicKey
  let user: KeypairSigner
  let user2: KeypairSigner
  let user3: KeypairSigner
  const treasury = generateSigner(umi).publicKey

  before(async () => {
    user = await createNewUser()
    user2 = await createNewUser()
    user3 = await createNewUser()
    ;[authority, raffler] = await createRaffloor("token burn", "token_burn", treasury)
    prize = await createNft(umi, true, undefined, authority.publicKey)
  })
  const entrants = generateSigner(umi)
  const raffle = findRafflePda(entrants.publicKey)

  it("can create a sol raffle, with unlimited entries paid by entrants", async () => {
    await createRaffle({
      prizeType: { nft: {} },
      authority,
      raffler,
      entrants,
      prize: prize.publicKey,
      tokenMint: nativeMint,
      ticketPrice: sol(0.001).basisPoints,
      startTime: Date.now() / 1000 + 1,
      numTickets: null,
      entryType: {
        spend: {},
      },
      duration: 6,
    })
  })

  it("cannot buy tickets before the raffle has started", async () => {
    await expectFail(
      () => buyTicketsToken(user, raffle, 1),
      (err) => assertErrorCode(err, "NotStarted")
    )
  })

  it("can wait 3 secs and buy a ticket", async () => {
    await sleep(3000)
    const balBefore = await umi.rpc.getBalance(entrants.publicKey)
    await buyTicketsToken(user, raffle, 1)
    const balanceAfter = await umi.rpc.getBalance(entrants.publicKey)

    console.log(balanceAfter.basisPoints - balBefore.basisPoints)
  })

  it("can buy max 320 tickets", async () => {
    await buyTicketsToken(user, raffle, 320)
  })

  it("Can buy another 320 tickets with another wallet", async () => {
    await buyTicketsToken(user2, raffle, 320)
  })

  it("Can buy another 320 tickets with another wallet", async () => {
    await buyTicketsToken(user3, raffle, 320)
  })

  it("Can buy another 320 tickets with the first wallet", async () => {
    await buyTicketsToken(user, raffle, 320)
  })

  it("can settle the raffle", async () => {
    await sleep(2000)
    await settleRaffle(randomnessService, raffle)
  })

  it("can claim", async () => {
    await claimPrize(user, raffle)
  })

  it("can claim the rent back as user", async () => {
    await programPaidBy(user)
      .methods.withdrawRent()
      .accounts({
        raffle,
        raffler,
        entrants: entrants.publicKey,
      })
      .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 10_000_000 })])
      .rpc()
      .catch((err) => console.log(err))
  })
})
