import { Packr } from "msgpackr"
import { decrypt } from "./decryption"

const packr = new Packr({
  /** نوع داده‌ای که برای اعداد 64 بیتی استفاده می‌شود. */
  int64AsType: "string",
  /** ⁧اگر `true` باشد، مقادیر `undefined` به صورت `nil` کدگذاری می‌شوند.  ⁩ */
  encodeUndefinedAsNil: true,
  /** ⁧ اگر `false` باشد، از ساختار رکوردها استفاده نمی‌شود. ⁩ */
  useRecords: false,
})

export async function unpack(
  data: ArrayBuffer,
  token?: string
): Promise<ArrayBuffer> {
  let buffered = null
  if (token) {
    const decryptedData = await decrypt(data, token)
    buffered = new Uint8Array(decryptedData)
  }

  const unpackedData = packr.unpack(buffered ?? (data as Buffer))

  return unpackedData instanceof Uint8Array
    ? unpackedData
    : new TextEncoder().encode(JSON.stringify(unpackedData))
}
