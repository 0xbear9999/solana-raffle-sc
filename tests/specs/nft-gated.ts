import { DigitalAsset, transferV1 } from "@metaplex-foundation/mpl-token-metadata"
import { createAssociatedToken } from "@metaplex-foundation/mpl-toolbox"
import { generateSigner, KeypairSigner, PublicKey, sol, unwrapOptionRecursively } from "@metaplex-foundation/umi"
import { createCollection } from "../helpers/create-collection"
import {
  createRaffle,
  buyTicketsToken,
  createRaffloor,
  buyTicketSendNft,
  buyTicketBurnNft,
} from "../helpers/instructions"
import { findRafflePda, nativeMint, getTokenAccount } from "../helpers/pdas"
import { umi } from "../helpers/umi"
import { expectFail, assertErrorCode, mintNfts } from "../helpers/utils"
import { createNft } from "../helpers/create-nft"
import { createNewUser } from "../helper"

describe("NFT gated raffles", () => {
  let gatedCollection: PublicKey
  let gatedNft: DigitalAsset
  let raffler: PublicKey
  let authority: KeypairSigner
  let user: KeypairSigner

  before(async () => {
    user = await createNewUser()
    ;[authority, raffler] = await createRaffloor("NFT gated raffle", "nft_gated")
    gatedCollection = (await createCollection(umi)).publicKey
    gatedNft = await createNft(umi, true, gatedCollection, authority.publicKey)
  })

  describe("Token raffle", () => {
    const entrants = generateSigner(umi)
    const raffle = findRafflePda(entrants.publicKey)

    it("can create an NFT gated raffle", async () => {
      const prize = await createNft(umi, true, undefined, authority.publicKey)
      await createRaffle({
        prizeType: { nft: {} },
        authority,
        entrants,
        raffler,
        numTickets: 100,
        entryType: {
          spend: {},
        },
        ticketPrice: sol(1).basisPoints,
        startTime: null,
        duration: 60,
        tokenMint: nativeMint,
        prize: prize.publicKey,
        gatedCollection,
      })
    })

    it("cannot buy a ticket without an entry NFT", async () => {
      await expectFail(
        () => buyTicketsToken(user, raffle, 1),
        (err) => assertErrorCode(err, "GatedRaffle")
      )
    })

    it("cannot buy a ticket with an entry NFT if not owned", async () => {
      await createAssociatedToken(umi, {
        mint: gatedNft.publicKey,
        owner: user.publicKey,
      }).sendAndConfirm(umi)

      await expectFail(
        () => buyTicketsToken(user, raffle, 1, gatedNft.publicKey),
        (err) => assertErrorCode(err, "GatedRaffle")
      )
    })

    it("can buy a ticket if it owns a required NFT", async () => {
      await transferV1(umi, {
        mint: gatedNft.publicKey,
        token: getTokenAccount(gatedNft.publicKey, authority.publicKey),
        tokenOwner: authority.publicKey,
        destinationToken: getTokenAccount(gatedNft.publicKey, user.publicKey),
        destinationOwner: user.publicKey,
        authority,
        tokenStandard: unwrapOptionRecursively(gatedNft.metadata.tokenStandard),
      }).sendAndConfirm(umi)
      await buyTicketsToken(user, raffle, 1, gatedNft.publicKey)

      await transferV1(umi, {
        mint: gatedNft.publicKey,
        token: getTokenAccount(gatedNft.publicKey, user.publicKey),
        tokenOwner: user.publicKey,
        destinationToken: getTokenAccount(gatedNft.publicKey, authority.publicKey),
        destinationOwner: authority.publicKey,
        authority: user,
        tokenStandard: unwrapOptionRecursively(gatedNft.metadata.tokenStandard),
      }).sendAndConfirm(umi)
    })
  })

  describe("pNFT transfer raffle", () => {
    const entrants = generateSigner(umi)
    const raffle = findRafflePda(entrants.publicKey)
    let collection: DigitalAsset
    let nfts: DigitalAsset[]

    before(async () => {
      collection = await createCollection(umi)
      nfts = await mintNfts(collection.publicKey, 5, true, user.publicKey)
    })

    it("can create an NFT gated raffle", async () => {
      const prize = await createNft(umi, true, undefined, authority.publicKey)
      await createRaffle({
        prizeType: { nft: {} },
        authority,
        entrants,
        raffler,
        numTickets: nfts.length,
        entryType: {
          spend: {},
        },
        ticketPrice: null,
        startTime: null,
        duration: 60,
        tokenMint: nativeMint,
        prize: prize.publicKey,
        entryCollectionMint: collection.publicKey,
        gatedCollection,
      })
    })

    it("cannot buy a ticket without an entry NFT", async () => {
      await expectFail(
        () => buyTicketSendNft(user, raffle, nfts[0].publicKey),
        (err) => assertErrorCode(err, "GatedRaffle")
      )
    })

    it("cannot buy a ticket with an entry NFT if not owned", async () => {
      await expectFail(
        () => buyTicketSendNft(user, raffle, nfts[0].publicKey, gatedNft.publicKey),
        (err) => assertErrorCode(err, "GatedRaffle")
      )
    })

    it("can buy a ticket if it owns a required NFT", async () => {
      await transferV1(umi, {
        mint: gatedNft.publicKey,
        token: getTokenAccount(gatedNft.publicKey, authority.publicKey),
        tokenOwner: authority.publicKey,
        destinationToken: getTokenAccount(gatedNft.publicKey, user.publicKey),
        destinationOwner: user.publicKey,
        authority,
        tokenStandard: unwrapOptionRecursively(gatedNft.metadata.tokenStandard),
      }).sendAndConfirm(umi)
      await buyTicketSendNft(user, raffle, nfts[0].publicKey, gatedNft.publicKey)
      await transferV1(umi, {
        mint: gatedNft.publicKey,
        token: getTokenAccount(gatedNft.publicKey, user.publicKey),
        tokenOwner: user.publicKey,
        destinationToken: getTokenAccount(gatedNft.publicKey, authority.publicKey),
        destinationOwner: authority.publicKey,
        authority: user,
        tokenStandard: unwrapOptionRecursively(gatedNft.metadata.tokenStandard),
      }).sendAndConfirm(umi)
    })
  })

  describe("pNFT burn raffle", () => {
    const entrants = generateSigner(umi)
    const raffle = findRafflePda(entrants.publicKey)
    let collection: DigitalAsset
    let nfts: DigitalAsset[]

    before(async () => {
      collection = await createCollection(umi)
      nfts = await mintNfts(collection.publicKey, 5, true, user.publicKey)
    })

    it("can create an NFT gated raffle", async () => {
      const prize = await createNft(umi, true, undefined, authority.publicKey)
      await createRaffle({
        prizeType: { nft: {} },
        authority,
        entrants,
        raffler,
        numTickets: nfts.length,
        entryType: {
          burn: {
            witholdBurnProceeds: false,
          },
        },
        ticketPrice: null,
        startTime: null,
        duration: 60,
        tokenMint: nativeMint,
        prize: prize.publicKey,
        entryCollectionMint: collection.publicKey,
        gatedCollection,
      })
    })

    it("cannot buy a ticket without an entry NFT", async () => {
      await expectFail(
        () => buyTicketBurnNft(user, raffle, nfts[0].publicKey),
        (err) => assertErrorCode(err, "GatedRaffle")
      )
    })

    it("cannot buy a ticket with an entry NFT if not owned", async () => {
      await expectFail(
        () => buyTicketBurnNft(user, raffle, nfts[0].publicKey, gatedNft.publicKey),
        (err) => assertErrorCode(err, "GatedRaffle")
      )
    })

    it("can buy a ticket if it owns a required NFT", async () => {
      await transferV1(umi, {
        mint: gatedNft.publicKey,
        token: getTokenAccount(gatedNft.publicKey, authority.publicKey),
        tokenOwner: authority.publicKey,
        destinationToken: getTokenAccount(gatedNft.publicKey, user.publicKey),
        destinationOwner: user.publicKey,
        authority,
        tokenStandard: unwrapOptionRecursively(gatedNft.metadata.tokenStandard),
      }).sendAndConfirm(umi)
      await buyTicketBurnNft(user, raffle, nfts[0].publicKey, gatedNft.publicKey)
    })
  })
})
