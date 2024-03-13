self.addEventListener("message", async (event) => {
  const { wallet } = event.data

  const res = await fetch(`/api/get-nfts/${wallet}`, {
    method: "GET",
    headers: {
      ContentType: "application/json",
      Accept: "application/json",
    },
  })

  const { digitalAssets } = await res.json()

  self.postMessage({
    digitalAssets,
  })
})
