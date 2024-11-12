export async function decrypt(data: ArrayBuffer, token: string) {
  const tokenAsBuffer = new TextEncoder().encode(token)
  const keyBuffer = tokenAsBuffer.slice(0, 16)
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    true,
    ["decrypt", "encrypt"]
  )

  const iv = data.slice(0, 12)
  const cypherText = data.slice(12)

  return await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      length: 128,
      tagLength: 128,
      iv,
    },
    key,
    cypherText
  )
}
