import { KeypairSigner, PublicKey, generateSigner } from "@metaplex-foundation/umi"
import { findRafflePda, findRafflerPda, getTokenAccount, nativeMint } from "../helpers/pdas"
import { createNft } from "../helpers/create-nft"
import { umi } from "../helpers/umi"
import { buyTicketBurnNft, claimPrize, createRaffle, createRaffloor, settleRaffle } from "../helpers/instructions"
import { DigitalAsset } from "@metaplex-foundation/mpl-token-metadata"
import { createCollection } from "../helpers/create-collection"
import { FEES_WALLET, PNFT_SIZE, TX_FEE, assertErrorCode, expectFail, getTokenAmount, mintNfts } from "../helpers/utils"
import { adminProgram, createNewUser, programPaidBy, randomnessService } from "../helper"
import { assert, use } from "chai"
import { eq } from "lodash"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"

describe("pNFT burn", () => {
  let authority: KeypairSigner
  let raffler: PublicKey
  let collection: DigitalAsset
  let nfts: DigitalAsset[]
  let user: KeypairSigner
  const treasury = generateSigner(umi).publicKey

  before(async () => {
    user = await createNewUser()
    ;[authority] = await createRaffloor("pNFT burn", "pnft_burn", treasury)
    raffler = findRafflerPda(authority.publicKey)
    collection = await createCollection(umi)
    nfts = await mintNfts(collection.publicKey, 5, true, user.publicKey)
  })

  const entrants = generateSigner(umi)
  const raffle = findRafflePda(entrants.publicKey)

  it("can create an NFT burn raffle", async () => {
    const prize = await createNft(umi, true, undefined, authority.publicKey)
    await createRaffle({
      authority,
      raffler,
      entrants,
      ticketPrice: null,
      startTime: null,
      duration: 60,
      prize: prize.publicKey,
      numTickets: 5,
      entryType: {
        burn: {
          witholdBurnProceeds: true,
        },
      },
      entryCollectionMint: collection.publicKey,
    })
  })

  it("Can enter burning the pNFT", async () => {
    let balanceBefore = await umi.rpc.getBalance(user.publicKey)
    await buyTicketBurnNft(user, raffle, nfts[0].publicKey)
    let balanceAfter = await umi.rpc.getBalance(user.publicKey)
    assert.equal(balanceBefore.basisPoints - balanceAfter.basisPoints, TX_FEE)
  })

  it("Cannot end the raffle", async () => {
    await expectFail(
      () => settleRaffle(randomnessService, raffle, true),
      (err) => assertErrorCode(err, "RaffleNotEnded")
    )
  })

  it("Can enter with the remaining NFTs, ending the raffle", async () => {
    const balanceBefore = await umi.rpc.getBalance(user.publicKey)
    await Promise.all(nfts.slice(1).map(async (nft) => buyTicketBurnNft(user, raffle, nft.publicKey)))
    const balanceAfter = await umi.rpc.getBalance(user.publicKey)

    assert.equal(balanceBefore.basisPoints - balanceAfter.basisPoints, 4n * TX_FEE, "Expected to pay 4x tx fee")
  })

  it("Can end the raffle", async () => {
    const balanceBefore = await umi.rpc.getBalance(umi.identity.publicKey)
    await settleRaffle(randomnessService, raffle)
    const balanceAfter = await umi.rpc.getBalance(umi.identity.publicKey)

    console.log("Cost: ", balanceBefore.basisPoints - balanceAfter.basisPoints)
    const raffleAcc = await adminProgram.account.raffle.fetch(raffle)
    assert.ok(raffleAcc.randomness, "Expected randomness to be set")
  })

  it("Can claim the prize, concluding the raffle", async () => {
    const userBalanceBefore = await umi.rpc.getBalance(user.publicKey)
    const treasuryBalBefore = await getTokenAmount(nativeMint, treasury)
    const feesBalBefore = await getTokenAmount(nativeMint, FEES_WALLET)
    await claimPrize(user, raffle)
    const userBalanceAfter = await umi.rpc.getBalance(user.publicKey)
    const treasuryBalAfter = await getTokenAmount(nativeMint, treasury)
    const feesBalAfter = await getTokenAmount(nativeMint, FEES_WALLET)
    const raffleAcc = await adminProgram.account.raffle.fetch(raffle)
    const prizeTokenAccBalance = await umi.rpc.getBalance(
      getTokenAccount(fromWeb3JsPublicKey(raffleAcc.prize), user.publicKey)
    )

    assert.equal(
      userBalanceBefore.basisPoints - userBalanceAfter.basisPoints,
      TX_FEE + prizeTokenAccBalance.basisPoints,
      "Expected to pay tx fee and token account for prize"
    )

    const proceeds = 5n * PNFT_SIZE

    assert.equal(
      treasuryBalAfter - treasuryBalBefore,
      (proceeds * 95n) / 100n,
      "Expected to receive the proceeds from 5 burned pNFTs"
    )

    assert.equal(feesBalAfter - feesBalBefore, (proceeds * 5n) / 100n, "Expected 5% proceeds fee to be paid")
  })
})
