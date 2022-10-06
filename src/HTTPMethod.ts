export enum HTTPMethod {
  GET = 'GET',
  PUT = 'PUT',
  POST = 'POST',
  HEAD = 'HEAD',
  DELETE = 'DELETE',
  CONNECT = 'CONNECT',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
  PATCH = 'PATCH',
}

/**
 * Checks if the given http method is valid.
 * @param method the method to check.
 * @returns if it is a valid method.
 */
export const isValidHttpMethod = (method: string): boolean => {
  return Object.values(HTTPMethod).includes(method as HTTPMethod);
}
