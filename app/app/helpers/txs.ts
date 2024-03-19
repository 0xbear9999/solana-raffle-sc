import * as anchor from "@coral-xyz/anchor"
import { PublicKey, Umi, publicKey, transactionBuilder, unwrapOptionRecursively } from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction, fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { TransactionInstruction } from "@solana/web3.js"
import { RaffleWithPublicKey } from "~/types/types"
import { getTokenAccount, getTokenRecordPda, nativeMint } from "./pdas"
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  fetchDigitalAsset,
  findMasterEditionPda,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata"
import { DAS } from "helius-sdk"
import { Raffle } from "~/types/raffle"
import { PriorityFees } from "~/constants"
import toast from "react-hot-toast"
import { MPL_TOKEN_AUTH_RULES_PROGRAM_ID } from "@metaplex-foundation/mpl-token-auth-rules"
import { displayErrorFromLog, packTx, sendAllTxsWithRetries } from "."

export async function buyTickets({
  umi,
  program,
  raffle,
  numTickets,
  digitalAssets,
  fetching,
  feeLevel,
  onStart,
  onComplete,
  onSuccess,
  nftMint,
}: {
  umi: Umi
  program: anchor.Program<Raffle>
  raffle: RaffleWithPublicKey
  numTickets: number | string
  digitalAssets: DAS.GetAssetResponse[]
  fetching: boolean
  feeLevel: PriorityFees
  onStart: Function
  onComplete: Function
  onSuccess: Function
  nftMint?: PublicKey
}) {
  try {
    onStart()
    const num = numTickets ? Number(numTickets) : 1

    const promise = Promise.resolve().then(async () => {
      let instruction: TransactionInstruction | null = null

      if (raffle.account.gatedCollection && fetching) {
        throw new Error("Reading wallet contents")
      }

      const gatedNft = raffle.account.gatedCollection
        ? digitalAssets.find((da) =>
            da.grouping?.find(
              (g) => g.group_key === "collection" && g.group_value === raffle.account.gatedCollection?.toBase58()
            )
          )
        : null

      const gatedNftMint = gatedNft ? publicKey(gatedNft.id) : null

      const rafflePk = fromWeb3JsPublicKey(raffle.publicKey)

      if (raffle.account.paymentType.token) {
        const tokenMint = fromWeb3JsPublicKey(raffle.account.paymentType.token.tokenMint)
        instruction = await program.methods
          .buyTicketsToken(num)
          .accounts({
            raffler: raffle.account.raffler,
            raffle: raffle.publicKey,
            entrants: raffle.account.entrants,
            tokenMint,
            tokenSource: getTokenAccount(umi, tokenMint, umi.identity.publicKey),
            tokenDestination: getTokenAccount(umi, tokenMint, rafflePk),
            gatedNftMint,
            gatedNftToken: gatedNftMint ? getTokenAccount(umi, gatedNftMint, umi.identity.publicKey) : null,
            gatedNftMetadata: gatedNftMint ? findMetadataPda(umi, { mint: gatedNftMint })[0] : null,
          })
          .instruction()
      } else {
        if (!nftMint) {
          throw new Error("NFT mint not provided")
        }
        const digitalAsset = await fetchDigitalAsset(umi, nftMint)
        const tokenStandard = unwrapOptionRecursively(digitalAsset.metadata.tokenStandard) || 0
        const isPnft = tokenStandard === TokenStandard.ProgrammableNonFungible
        const isEdition = [TokenStandard.ProgrammableNonFungibleEdition, TokenStandard.NonFungibleEdition].includes(
          tokenStandard
        )
        const coll = unwrapOptionRecursively(digitalAsset.metadata.collection)
        const nftCollection = (coll?.verified && coll.key) || null
        if (raffle.account.entryType.burn) {
          instruction = await program.methods
            .buyTicketBurnNft()
            .accounts({
              raffler: raffle.account.raffler,
              raffle: raffle.publicKey,
              entrants: raffle.account.entrants,
              ownerTokenRecord: isPnft ? getTokenRecordPda(umi, nftMint, umi.identity.publicKey) : null,
              destinationTokenRecord: isPnft ? getTokenRecordPda(umi, nftMint, rafflePk) : null,
              nftMint,
              nftSource: getTokenAccount(umi, nftMint, umi.identity.publicKey),
              nftMetadata: digitalAsset.metadata.publicKey,
              nftEdition: digitalAsset.edition?.publicKey || null,
              nftMasterEdition: isEdition ? findMasterEditionPda(umi, { mint: nftMint })[0] : null,
              nftCollection,
              nativeMint,
              tokenDestination: raffle.account.entryType.burn?.witholdBurnProceeds
                ? getTokenAccount(umi, nativeMint, rafflePk)
                : null,
              nftCollectionMetadata: nftCollection ? findMetadataPda(umi, { mint: nftCollection })[0] : null,
              metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
              sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              authRules: unwrapOptionRecursively(digitalAsset.metadata.programmableConfig)?.ruleSet,
              authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
              gatedNftMint,
              gatedNftToken: gatedNftMint ? getTokenAccount(umi, gatedNftMint, umi.identity.publicKey) : null,
              gatedNftMetadata: gatedNftMint ? findMetadataPda(umi, { mint: gatedNftMint })[0] : null,
            })
            .instruction()
        } else {
          instruction = await program.methods
            .buyTicketSendNft()
            .accounts({
              raffler: raffle.account.raffler,
              raffle: rafflePk,
              entrants: raffle.account.entrants,
              ownerTokenRecord: isPnft ? getTokenRecordPda(umi, nftMint, umi.identity.publicKey) : null,
              destinationTokenRecord: isPnft ? getTokenRecordPda(umi, nftMint, rafflePk) : null,
              nftMint,
              nftSource: getTokenAccount(umi, nftMint, umi.identity.publicKey),
              nftDestination: getTokenAccount(umi, nftMint, rafflePk),
              nftMetadata: digitalAsset.metadata.publicKey,
              nftEdition: digitalAsset.edition?.publicKey || null,
              metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
              sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              authRules: unwrapOptionRecursively(digitalAsset.metadata.programmableConfig)?.ruleSet,
              authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
              gatedNftMint,
              gatedNftToken: gatedNftMint ? getTokenAccount(umi, gatedNftMint, umi.identity.publicKey) : null,
              gatedNftMetadata: gatedNftMint ? findMetadataPda(umi, { mint: gatedNftMint })[0] : null,
            })
            .instruction()
        }
      }

      let tx = transactionBuilder().add({
        instruction: fromWeb3JsInstruction(instruction!),
        bytesCreatedOnChain: 32,
        signers: [umi.identity],
      })

      const { chunks, txFee } = await packTx(umi, tx, feeLevel, 500_000)
      const signed = await Promise.all(chunks.map((c) => c.buildAndSign(umi)))
      return await sendAllTxsWithRetries(umi, program.provider.connection, signed, 1 + (txFee ? 1 : 0))
    })

    toast.promise(promise, {
      loading: `Buying ${num} ticket${num === 1 ? "" : "s"}`,
      success: "Success",
      error: (err) =>
        displayErrorFromLog(
          err,
          raffle.account.paymentType.token?.tokenMint.toBase58() === nativeMint
            ? "SOL raffles can become congested, try again with elevated Priority fees"
            : "Error buying tickets"
        ),
    })

    await promise
    onSuccess()
  } catch (err: any) {
    console.error(err)
  } finally {
    onComplete()
  }
}
