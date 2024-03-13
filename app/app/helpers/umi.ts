import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata"
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox"
import { createUmi } from "@metaplex-foundation/umi"
import { web3JsEddsa } from "@metaplex-foundation/umi-eddsa-web3js"

export const umi = createUmi().use(web3JsEddsa())
