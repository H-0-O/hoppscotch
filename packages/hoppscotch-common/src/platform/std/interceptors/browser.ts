import * as E from "fp-ts/Either"

import {
  Interceptor,
  InterceptorError,
  NetworkResponse,
  RequestRunResult,
} from "../../../services/interceptor.service"
import axios, { AxiosRequestConfig, CancelToken } from "axios"
import { preProcessRequest } from "./helpers"
import { cloneDeep } from "lodash-es"
import { unpack } from "~/helpers/utils/msgpack"

export const preProcessRequest = (
  req: AxiosRequestConfig
): AxiosRequestConfig => {
  const reqClone = cloneDeep(req)

  // If the parameters are URLSearchParams, inject them to URL instead
  // This prevents issues of marshalling the URLSearchParams to the proxy
  if (reqClone.params instanceof URLSearchParams) {
    try {
      const url = new URL(reqClone.url ?? "")

      for (const [key, value] of reqClone.params.entries()) {
        url.searchParams.append(key, value)
      }

      reqClone.url = url.toString()
    } catch (e) {
      // making this a non-empty block, so we can make the linter happy.
      // we should probably use, allowEmptyCatch, or take the time to do something with the caught errors :)
    }

    reqClone.params = {}
  }

  return reqClone
}

async function runRequest(
  req: AxiosRequestConfig,
  cancelToken: CancelToken
): RequestRunResult["response"] {
  const timeStart = Date.now()

  try {
    if (!req.headers) req.headers = {}
    req.headers["Content-Type"] = "application/octet-stream"

    const res = await axios({
      ...req,
      cancelToken,
      responseType: "arraybuffer",
    })

    const getHeaderToken = (): string => {
      const authHeader = req.headers?.Authorization
      if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim()
      }
      throw Error("Need Token to Decrypt MSGPack Data")
    }

    res.data = await unpack(res.data, getHeaderToken())
    res.headers["content-type"] = "application/json"

    const timeEnd = Date.now()

    return E.right(<NetworkResponse>{
      ...res,
      config: {
        timeData: {
          startTime: timeStart,
          endTime: timeEnd,
        },
      },
    })
  } catch (e) {
    const timeEnd = Date.now()

    if (axios.isAxiosError(e) && e.response) {
      e.response.data = await unpack(e.response.data)
      e.response.headers["content-type"] = "application/json"

      return E.right(<NetworkResponse>{
        ...e.response,
        config: {
          timeData: {
            startTime: timeStart,
            endTime: timeEnd,
          },
        },
      })
    } else if (axios.isCancel(e)) {
      return E.left("cancellation")
    }
    return E.left(<InterceptorError>{
      humanMessage: {
        heading: (t) => t("error.network_fail"),
        description: (t) => t("helpers.network_fail"),
      },
      error: e,
    })
  }
}

export const browserInterceptor: Interceptor = {
  interceptorID: "browser",
  name: (t) => t("state.none"),
  selectable: { type: "selectable" },
  runRequest(req) {
    const cancelToken = axios.CancelToken.source()

    const processedReq = preProcessRequest(req)

    const promise = runRequest(processedReq, cancelToken.token)

    return {
      cancel: () => cancelToken.cancel(),
      response: promise,
    }
  },
}
