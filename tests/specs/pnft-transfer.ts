import { DigitalAsset } from "@metaplex-foundation/mpl-token-metadata"
import { KeypairSigner, PublicKey, generateSigner, sol } from "@metaplex-foundation/umi"
import { assert } from "chai"
import { randomnessService, adminProgram, createNewUser } from "../helper"
import { createCollection } from "../helpers/create-collection"
import {
  createRaffle,
  settleRaffle,
  claimPrize,
  collectNft,
  createRaffloor,
  buyTicketSendNft,
} from "../helpers/instructions"
import { findRafflerPda, findRafflePda } from "../helpers/pdas"
import { umi } from "../helpers/umi"
import { mintNfts, getEntrantsArray, expectFail, assertErrorCode, getTokenAmount } from "../helpers/utils"
import { createNft } from "../helpers/create-nft"

describe("pNFT raffle with pnfts as currency", () => {
  let collection: DigitalAsset
  let invalidCollection: DigitalAsset
  let validNfts: DigitalAsset[]
  let invalidNft: DigitalAsset
  let prize: DigitalAsset
  let authority: KeypairSigner
  let raffler: PublicKey
  let user: KeypairSigner
  const numTickets = 3
  const treasury = generateSigner(umi).publicKey

  before(async () => {
    ;[authority, raffler] = await createRaffloor("pNFT transfer", "pnft_transfer", treasury)
    user = await createNewUser()
    prize = await createNft(umi, true, undefined, authority.publicKey)
    collection = await createCollection(umi)
    invalidCollection = await createCollection(umi)
    validNfts = await mintNfts(collection.publicKey, 3, true, user.publicKey)
    invalidNft = await createNft(umi, true, invalidCollection.publicKey, user.publicKey)
  })

  const entrants = generateSigner(umi)
  const raffle = findRafflePda(entrants.publicKey)

  it("can create a raffle", async () => {
    await createRaffle({
      authority,
      raffler,
      entrants,
      numTickets,
      tokenMint: null,
      entryType: {
        spend: {},
      },
      ticketPrice: null,
      duration: 60 * 60 * 24,
      prize: prize.publicKey,
      entryCollectionMint: collection.publicKey,
    })
  })

  // it("cannot buy a ticket with an invalid NFT", async () => {
  //   await expectFail(
  //     () => buyTicketsNft(user, raffle, invalidNft.publicKey),
  //     (err) => assertErrorCode(err, "InvalidCollection")
  //   )
  // })

  it("Can buy a ticket with a valid pNFT", async () => {
    await buyTicketSendNft(user, raffle, validNfts[0].publicKey)
    const entrantsArray = await getEntrantsArray(entrants.publicKey)
    assert.ok(entrantsArray.includes(user.publicKey))
  })

  it("cannot draw a winner if raffle not ended", async () => {
    await expectFail(
      () => settleRaffle(randomnessService, raffle, true),
      (err) => assertErrorCode(err, "RaffleNotEnded")
    )
  })

  it("Can buy 2 more tickets with a valid pNFT, ending the raffle", async () => {
    const nfts = validNfts.slice(1)
    await Promise.all(nfts.map(async (nft) => buyTicketSendNft(user, raffle, nft.publicKey)))
  })

  it("can draw a winner", async () => {
    await settleRaffle(randomnessService, raffle)

    const raffleAcc = await adminProgram.account.raffle.fetch(raffle)

    assert.ok(raffleAcc.randomness, "Expected raffle to be settled")
  })

  it("cannot draw a winner if one has already been drawn", async () => {
    await expectFail(
      () => settleRaffle(randomnessService, raffle, true),
      (err) => assertErrorCode(err, "WinnerAlreadyDrawn")
    )
  })

  it("can claim with the winning ticket", async () => {
    await claimPrize(user, raffle)

    const nftBalance = await getTokenAmount(prize.publicKey, user.publicKey)

    assert.equal(nftBalance, 1n, "Expected winner to have claimed prize")
  })

  it("can claim the proceeds NFTs as an admin", async () => {
    await Promise.all(validNfts.map(async (nft) => collectNft(authority, raffle, nft.publicKey)))

    const nft1Bal = await getTokenAmount(validNfts[0].publicKey, treasury)
    assert.equal(nft1Bal, 1n, "Expected NFT to be transferred to treasury")
  })
})
