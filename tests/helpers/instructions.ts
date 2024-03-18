import * as anchor from "@coral-xyz/anchor"
import { KeypairSigner, PublicKey, generateSigner, publicKey, unwrapOptionRecursively } from "@metaplex-foundation/umi"
import { adminProgram, createNewUser, programPaidBy } from "../helper"
import {
  findProgramConfigPda,
  findRafflePda,
  findRafflerPda,
  getTokenAccount,
  getTokenRecordPda,
  nativeMint,
} from "./pdas"
import { umi } from "./umi"
import { createAccount, getSysvar } from "@metaplex-foundation/mpl-toolbox"
import { fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  fetchDigitalAsset,
  findMasterEditionPda,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata"
import { MPL_TOKEN_AUTH_RULES_PROGRAM_ID } from "@metaplex-foundation/mpl-token-auth-rules"
import { RandomnessService, SimpleRandomnessV1SettledEvent } from "@switchboard-xyz/solana-randomness-service"
import { assert } from "chai"
import { FEES_WALLET, expandRandomness, getEntrantsArray } from "./utils"

export async function createRaffloor(
  name: string,
  slug: string,
  treasury?: PublicKey,
  staker?: PublicKey
): Promise<[KeypairSigner, PublicKey]> {
  const authority = await createNewUser()
  const program = programPaidBy(authority)
  const raffler = findRafflerPda(authority.publicKey)
  await program.methods
    .init(name, slug, null, null)
    .accounts({
      programConfig: findProgramConfigPda(),
      raffler,
      treasury: treasury || null,
      staker: staker || null,
    })
    .rpc()

  return [authority, raffler]
}

type EntryType = { spend: {} } | { burn: { witholdBurnProceeds: boolean } } | { stake: { minimumPeriod: anchor.BN } }

type PrizeType = { nft: {} } | { token: { amount: anchor.BN } }

export async function createRaffle({
  prizeType,
  authority,
  entryType = { spend: {} },
  entrants,
  raffler,
  numTickets,
  ticketPrice,
  startTime = null,
  duration,
  prize,
  tokenMint = null,
  entryCollectionMint = null,
  gatedCollection = null,
  maxEntriesPct = null,
}: {
  prizeType: PrizeType
  authority: KeypairSigner
  entryType: EntryType
  entrants: KeypairSigner
  raffler: PublicKey
  numTickets: number | null
  ticketPrice: BigInt
  duration: number
  prize: PublicKey
  startTime?: number | null
  tokenMint?: PublicKey | null
  entryCollectionMint?: PublicKey | null
  gatedCollection?: PublicKey | null
  witholdBurnProceeds?: boolean
  maxEntriesPct?: number | null
}) {
  const program = programPaidBy(authority)
  const rafflerAcc = await program.account.raffler.fetch(raffler)
  const dataLen = 8 + 4 + 4 + numTickets * 32
  const rent = await umi.rpc.getRent(dataLen)
  await createAccount(umi, {
    newAccount: entrants,
    space: dataLen,
    lamports: rent,
    programId: fromWeb3JsPublicKey(program.programId),
  }).sendAndConfirm(umi)

  const raffle = findRafflePda(entrants.publicKey)

  const treasury = fromWeb3JsPublicKey(rafflerAcc.treasury)
  const prizeAcc = await fetchDigitalAsset(umi, prize)

  const isPfnt = unwrapOptionRecursively(prizeAcc.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible
  const payer = fromWeb3JsPublicKey(program.provider.publicKey)

  tokenMint = (entryType as any).burn?.witholdBurnProceeds ? nativeMint : tokenMint

  const remainingAccounts: anchor.web3.AccountMeta[] = []

  if (gatedCollection) {
    remainingAccounts.push({
      pubkey: toWeb3JsPublicKey(gatedCollection),
      isSigner: false,
      isWritable: false,
    })
  }

  if ("nft" in prizeType) {
    remainingAccounts.push(
      {
        pubkey: toWeb3JsPublicKey(prizeAcc.metadata.publicKey),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: toWeb3JsPublicKey(prizeAcc.edition.publicKey),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        isWritable: false,
        isSigner: false,
      }
    )
  }

  if (isPfnt) {
    remainingAccounts.push(
      {
        pubkey: toWeb3JsPublicKey(getTokenRecordPda(prize, payer)),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: toWeb3JsPublicKey(getTokenRecordPda(prize, raffle)),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: toWeb3JsPublicKey(MPL_TOKEN_AUTH_RULES_PROGRAM_ID),
        isWritable: false,
        isSigner: false,
      }
    )
    const authRules = unwrapOptionRecursively(prizeAcc.metadata.programmableConfig)?.ruleSet
    if (authRules) {
      remainingAccounts.push({
        pubkey: toWeb3JsPublicKey(authRules),
        isSigner: false,
        isWritable: false,
      })
    }
  }

  await program.methods
    .initRaffle(
      prizeType,
      numTickets,
      entryType,
      ticketPrice ? new anchor.BN(ticketPrice.toString()) : null,
      startTime ? new anchor.BN(startTime) : null,
      new anchor.BN(duration),
      !!gatedCollection,
      maxEntriesPct
    )
    .accounts({
      raffler,
      raffle,
      entrants: entrants.publicKey,
      tokenMint,
      entryCollectionMint,
      tokenVault: tokenMint ? getTokenAccount(tokenMint, raffle) : null,
      prize,
      treasury,
      feesWallet: tokenMint ? FEES_WALLET : null,
      feesWalletToken: tokenMint ? getTokenAccount(tokenMint, FEES_WALLET) : null,
      treasuryTokenAccount: tokenMint ? getTokenAccount(tokenMint, treasury) : null,
      prizeToken: getTokenAccount(prize, payer),
      prizeCustody: getTokenAccount(prize, raffle),
      metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 })])
    .rpc()
    .catch((err) => console.error(err))
}

export async function buyTicketsToken(
  user: KeypairSigner,
  raffle: PublicKey,
  amount: number,
  gatedNftMint: PublicKey | null = null
) {
  const program = programPaidBy(user)
  const raffleAcc = await program.account.raffle.fetch(raffle)
  const tokenMint = fromWeb3JsPublicKey(raffleAcc.paymentType.token.tokenMint)
  const entrant = fromWeb3JsPublicKey(program.provider.publicKey)

  return await program.methods
    .buyTicketsToken(amount)
    .accounts({
      raffler: raffleAcc.raffler,
      raffle,
      entrants: raffleAcc.entrants,
      tokenMint,
      tokenSource: getTokenAccount(tokenMint, entrant),
      tokenDestination: getTokenAccount(tokenMint, raffle),
      gatedNftMint,
      gatedNftToken: gatedNftMint ? getTokenAccount(gatedNftMint, user.publicKey) : null,
      gatedNftMetadata: gatedNftMint ? findMetadataPda(umi, { mint: gatedNftMint })[0] : null,
    })
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })])
    .rpc()
}

export async function settleRaffle(
  randomnessService: RandomnessService,
  raffle: PublicKey,
  uri = "https://test.com",
  expectFail?: boolean
) {
  const raffleAcc = await adminProgram.account.raffle.fetch(raffle)

  const requestKeypair = anchor.web3.Keypair.generate()
  // Start watching for the settled event before triggering the request
  let settledRandomnessEventPromise: Promise<[SimpleRandomnessV1SettledEvent, number]>
  if (!expectFail) {
    settledRandomnessEventPromise = randomnessService.awaitSettledEvent(requestKeypair.publicKey)
  }

  await adminProgram.methods
    .drawWinner(uri, new anchor.BN(1000))
    .accounts({
      raffle,
      entrants: raffleAcc.entrants,
      randomnessService: randomnessService.programId,
      randomnessRequest: requestKeypair.publicKey,
      randomnessEscrow: anchor.utils.token.associatedAddress({
        mint: randomnessService.accounts.mint,
        owner: requestKeypair.publicKey,
      }),
      randomnessState: randomnessService.accounts.state,
      randomnessMint: randomnessService.accounts.mint,
    })
    .signers([requestKeypair])
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })])
    .rpc()

  if (!expectFail) {
    // Await the response from the Switchboard Service
    const [settledRandomnessEvent, settledSlot] = await settledRandomnessEventPromise
    assert.equal(
      settledRandomnessEvent.user.toBase58(),
      adminProgram.provider.publicKey.toBase58(),
      "User should be the same as the provider wallet"
    )
    assert.equal(
      settledRandomnessEvent.request.toBase58(),
      requestKeypair.publicKey.toBase58(),
      "Request should be the same as the provided request keypair"
    )
    assert.equal(settledRandomnessEvent.isSuccess, true, "Request did not complete successfully")
  }
}

export async function claimPrize(user: KeypairSigner, raffle: PublicKey, ticketIndex?: number) {
  const program = programPaidBy(user)
  const raffleAcc = await program.account.raffle.fetch(raffle)
  const rafflerAcc = await program.account.raffler.fetch(raffleAcc.raffler)
  const entrants = await program.account.entrants.fetch(raffleAcc.entrants)
  let proceedsMint = raffleAcc.paymentType.token?.tokenMint
    ? fromWeb3JsPublicKey(raffleAcc.paymentType.token.tokenMint)
    : null

  if (raffleAcc.paymentType.nft && raffleAcc.entryType.burn?.witholdBurnProceeds) {
    proceedsMint = nativeMint
  }

  const prizeDa = await fetchDigitalAsset(umi, fromWeb3JsPublicKey(raffleAcc.prize))
  const isPnft = unwrapOptionRecursively(prizeDa.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible

  let winner: PublicKey
  let winnerIndex = 0
  if (raffleAcc.randomness) {
    const winnerRand = expandRandomness(raffleAcc.randomness)
    winnerIndex = winnerRand % entrants.total

    const entrantsArray = await getEntrantsArray(fromWeb3JsPublicKey(raffleAcc.entrants))
    winner = entrantsArray[winnerIndex]
  } else {
    winner = user.publicKey
  }

  const treasury = fromWeb3JsPublicKey(rafflerAcc.treasury)

  const remainingAccounts: anchor.web3.AccountMeta[] = []

  if (raffleAcc.prizeType.nft) {
    remainingAccounts.push(
      {
        pubkey: toWeb3JsPublicKey(prizeDa.metadata.publicKey),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: toWeb3JsPublicKey(prizeDa.edition.publicKey),
        isWritable: false,
        isSigner: false,
      }
    )
  }

  if (isPnft) {
    remainingAccounts.push(
      {
        pubkey: toWeb3JsPublicKey(getTokenRecordPda(prizeDa.publicKey, raffle)),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: toWeb3JsPublicKey(getTokenRecordPda(prizeDa.publicKey, winner)),
        isWritable: true,
        isSigner: false,
      }
    )
  }

  return await program.methods
    .claimPrize(ticketIndex || winnerIndex)
    .accounts({
      programConfig: findProgramConfigPda(),
      raffle,
      raffler: raffleAcc.raffler,
      proceedsMint,
      feesWallet: FEES_WALLET,
      feesWalletToken: proceedsMint ? getTokenAccount(proceedsMint, FEES_WALLET) : null,
      proceedsSource: proceedsMint ? getTokenAccount(proceedsMint, raffle) : null,
      proceedsDestination: proceedsMint ? getTokenAccount(proceedsMint, treasury) : null,
      entrants: raffleAcc.entrants,
      prize: prizeDa.publicKey,
      treasury,
      prizeCustody: getTokenAccount(prizeDa.publicKey, raffle),
      prizeDestination: getTokenAccount(prizeDa.publicKey, winner),
      metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      authority: rafflerAcc.authority,
      winner,
      authRules: unwrapOptionRecursively(prizeDa.metadata.programmableConfig)?.ruleSet || null,
      authRulesProgram: isPnft ? MPL_TOKEN_AUTH_RULES_PROGRAM_ID : null,
    })
    .remainingAccounts(remainingAccounts)
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 })])
    .rpc()
}

export async function collectNft(authority: KeypairSigner, raffle: PublicKey, nftMint: PublicKey) {
  const program = programPaidBy(authority)
  const raffleAcc = await program.account.raffle.fetch(raffle)
  const rafflerAcc = await program.account.raffler.fetch(raffleAcc.raffler)
  const nftDa = await fetchDigitalAsset(umi, nftMint)
  const isPnft = unwrapOptionRecursively(nftDa.metadata.publicKey)
  const treasury = fromWeb3JsPublicKey(rafflerAcc.treasury)
  await program.methods
    .collectNft()
    .accounts({
      raffle,
      raffler: raffleAcc.raffler,
      authority: rafflerAcc.authority,
      treasury,
      nftMint,
      nftSource: getTokenAccount(nftMint, raffle),
      nftDestination: getTokenAccount(nftMint, treasury),
      nftEdition: findMasterEditionPda(umi, { mint: nftMint })[0],
      nftMetadata: findMetadataPda(umi, { mint: nftMint })[0],
      sourceTokenRecord: isPnft ? getTokenRecordPda(nftMint, raffle) : null,
      destinationTokenRecord: isPnft ? getTokenRecordPda(nftMint, treasury) : null,
      authRules: unwrapOptionRecursively(nftDa.metadata.programmableConfig)?.ruleSet,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
      metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      sysvarInstructions: getSysvar("instructions"),
    })
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })])
    .rpc()
}

export async function buyTicketSendNft(
  user: KeypairSigner,
  raffle: PublicKey,
  nftMint: PublicKey,
  gatedNftMint: PublicKey | null = null
) {
  const program = programPaidBy(user)
  const raffleAcc = await program.account.raffle.fetch(raffle)
  const nftDa = await fetchDigitalAsset(umi, nftMint)
  const isPnft = unwrapOptionRecursively(nftDa.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible
  const nftCollection = raffleAcc.entryType.burn ? unwrapOptionRecursively(nftDa.metadata.collection).key : null

  return await program.methods
    .buyTicketSendNft()
    .accounts({
      raffler: raffleAcc.raffler,
      raffle,
      entrants: raffleAcc.entrants,
      ownerTokenRecord: isPnft ? getTokenRecordPda(nftMint, user.publicKey) : null,
      destinationTokenRecord: isPnft ? getTokenRecordPda(nftMint, raffle) : null,
      nftMint,
      nftSource: getTokenAccount(nftMint, user.publicKey),
      nftDestination: getTokenAccount(nftMint, raffle),
      nftMetadata: nftDa.metadata.publicKey,
      nftEdition: nftDa.edition.publicKey,
      metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      authRules: unwrapOptionRecursively(nftDa.metadata.programmableConfig)?.ruleSet,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
      gatedNftMint,
      gatedNftToken: gatedNftMint ? getTokenAccount(gatedNftMint, user.publicKey) : null,
      gatedNftMetadata: gatedNftMint ? findMetadataPda(umi, { mint: gatedNftMint })[0] : null,
    })
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })])
    .rpc()
}

export async function buyTicketBurnNft(
  user: KeypairSigner,
  raffle: PublicKey,
  nftMint: PublicKey,
  gatedNftMint: PublicKey | null = null
) {
  const program = programPaidBy(user)
  const raffleAcc = await program.account.raffle.fetch(raffle)
  const nftDa = await fetchDigitalAsset(umi, nftMint)
  const isPnft = unwrapOptionRecursively(nftDa.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible
  const nftCollection = raffleAcc.entryType.burn ? unwrapOptionRecursively(nftDa.metadata.collection).key : null

  const isEdition = [TokenStandard.NonFungibleEdition, TokenStandard.ProgrammableNonFungibleEdition].includes(
    unwrapOptionRecursively(nftDa.metadata.tokenStandard)
  )

  return await program.methods
    .buyTicketBurnNft()
    .accounts({
      raffler: raffleAcc.raffler,
      raffle,
      entrants: raffleAcc.entrants,
      ownerTokenRecord: isPnft ? getTokenRecordPda(nftMint, user.publicKey) : null,
      destinationTokenRecord: isPnft ? getTokenRecordPda(nftMint, raffle) : null,
      nftMint,
      nftSource: getTokenAccount(nftMint, user.publicKey),
      nftMetadata: nftDa.metadata.publicKey,
      nftEdition: nftDa.edition.publicKey,
      nftMasterEdition: isEdition ? findMasterEditionPda(umi, { mint: nftMint })[0] : null,
      nftCollection,
      nativeMint,
      tokenDestination: raffleAcc.entryType.burn?.witholdBurnProceeds ? getTokenAccount(nativeMint, raffle) : null,
      nftCollectionMetadata: nftCollection ? findMetadataPda(umi, { mint: nftCollection })[0] : null,
      metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
      authRules: unwrapOptionRecursively(nftDa.metadata.programmableConfig)?.ruleSet,
      authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
      gatedNftMint,
      gatedNftToken: gatedNftMint ? getTokenAccount(gatedNftMint, user.publicKey) : null,
      gatedNftMetadata: gatedNftMint ? findMetadataPda(umi, { mint: gatedNftMint })[0] : null,
    })
    .preInstructions([anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })])
    .rpc()
}
