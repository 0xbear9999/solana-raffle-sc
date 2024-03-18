import { Card, CardBody, CardHeader } from "@nextui-org/react"
import { Page } from "~/components/Page"
import { PanelCard } from "~/components/PanelCard"
import { Title } from "~/components/Title"

export default function Pricing() {
  return (
    <Page>
      <PanelCard
        title={
          <span>
            Pricing <Title />
          </span>
        }
      >
        <h3 className="text-xl uppercase font-bold text-primary">Fees</h3>
        <p>
          Entries are subject to <span className="text-primary font-bold">0.0002 SOL</span> rent per ticket, this is
          witheld by the program.
        </p>
        <p>
          A flat rate of <span className="text-primary font-bold">2.5%</span> of any raffle proceeds is collected by the
          platform on the conclusion of a raffle, with the exception of NFT transfer raffles.
        </p>
        <p>These funds pay for our infrastructure, future development, and to ensure a smooth running service!</p>
        <h3 className="text-xl uppercase font-bold text-primary">Rent</h3>
        <p>
          To conclude the raffle, Switchboard accounts need to be created which uses{" "}
          <span className="text-primary font-bold text-nowrap">~0.007 SOL</span> in rent (at time of writing) - this is
          refunded in the Oracle response transaction, minus network fees.
        </p>
        <p>
          All rent from closing token accounts is repaid in full back to the raffle organiser/entrants as appropriate,
          with the exception of NFT Burn raffles, where the project can choose to withold the rent as an entry fee.
        </p>
      </PanelCard>
    </Page>
  )
}
