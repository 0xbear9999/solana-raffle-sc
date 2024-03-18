import { KeypairSigner, PublicKey, generateSigner, sol } from "@metaplex-foundation/umi"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { assert } from "chai"
import { adminProgram, createNewUser } from "../helper"
import { createRaffle, claimPrize, buyTicketsToken, createRaffloor } from "../helpers/instructions"
import { findRafflePda, nativeMint, getTokenAccount } from "../helpers/pdas"
import { umi } from "../helpers/umi"
import { getTokenAmount, expectFail, assertErrorCode } from "../helpers/utils"
import { createNft } from "../helpers/create-nft"

describe("Aborted by creator", () => {
  const entrants = generateSigner(umi)
  const raffle = findRafflePda(entrants.publicKey)
  let authority: KeypairSigner
  let raffler: PublicKey
  let user: KeypairSigner
  before(async () => {
    user = await createNewUser()
    ;[authority, raffler] = await createRaffloor("Admin actions", "admin_action")
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
    })
  })

  it("Cannot claim the prize as non-admin", async () => {
    await expectFail(
      () => claimPrize(user, raffle),
      (err) => assertErrorCode(err, "OnlyAdminCanClaim")
    )
  })

  it("Can claim the prize back as admin, ending the raffle", async () => {
    await claimPrize(authority, raffle)
    const raffleAcc = await adminProgram.account.raffle.fetch(raffle)
    assert.ok(raffleAcc.claimed, "Expected to be marked as claimed")
    const tokenBalance = await getTokenAmount(fromWeb3JsPublicKey(raffleAcc.prize), authority.publicKey)
    assert.equal(tokenBalance, 1n, "Expected user to have claimed back prize")

    assert.ok(
      !(await umi.rpc.accountExists(getTokenAccount(fromWeb3JsPublicKey(raffleAcc.prize), raffle))),
      "expected prize custody to no longer exist"
    )
  })

  it("Cannot buy tickets after prize claimed", async () => {
    await expectFail(
      () => buyTicketsToken(user, raffle, 2),
      (err) => assertErrorCode(err, "AccountNotInitialized")
    )
  })
})
