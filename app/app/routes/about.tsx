import { Card, CardBody, CardHeader, Link } from "@nextui-org/react"
import { Page } from "~/components/Page"
import { PanelCard } from "~/components/PanelCard"
import { Title } from "~/components/Title"
import { metadata } from "~/idl/raffle.json"

export default function About() {
  return (
    <Page>
      <PanelCard
        title={
          <span>
            About <Title />
          </span>
        }
      >
        <p>
          <Title /> is a decentralized platform for building and hosting raffle apps for NFT collections, groups, DAOs,
          communities, or individuals on the Solana blockchain.
        </p>
        <p>
          <Title /> leverages{" "}
          <Link href="https://switchboard.xyz/" target="_blank" rel="noreferrer">
            Switchboard Oracles
          </Link>{" "}
          for true on-chain randomness, in place of the commonly used{" "}
          <Link href="https://solana.stackexchange.com/a/6109/5363" target="_blank" rel="noreferrer">
            Recent Blockhashes
          </Link>{" "}
          method which can be exploited by validators to obtain a favourable outcome.
        </p>
        <p>
          The program address is <Link href={`https://solscan.io/account/${metadata.address}`}>{metadata.address}</Link>
        </p>
        <p>
          Winners are drawn using Switchboard's{" "}
          <Link href="https://crates.io/crates/solana-randomness-service" target="_blank" rel="noreferrer">
            Solana Randomness Service
          </Link>{" "}
          to ensure the results cannot be influenced by validators, or picked at a favourable time.
        </p>
        <p>Anyone can draw a raffle once the time is concluded, or all tickets are sold.</p>
        <p>
          Tickets can be purchased for SOL, SPL Tokens, or by sending specific NFTs which can be either burned on
          purchase, or collected by the raffle organiser.
        </p>
        <p>
          <Title /> also supports NFT Gated Raffles, which can only be entered by holders of an NFT from a certain
          collection. This service is offered free of charge {"<3"}
        </p>
      </PanelCard>
    </Page>
  )
}
