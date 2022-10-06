import { HTTPRequest } from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import { HTTPRouterNextFunction } from "../HTTPRouter";

export const _simple = (
  request: HTTPRequest,
  response: HTTPResponse,
  next: HTTPRouterNextFunction
): void => {
  console.info(`${request.method} ${request.rawUri!} ${request.version}:`);
  for (const header of request.headers!.iterator()) {
    if (Array.isArray(header.value)) {
      console.info(`\t${header.key}: `);
      for (const value of header.value) console.trace(`\t\t${value}`);
    } else console.info(`\t${header.key}: ${header.value}`);
  }

  return next();
};
