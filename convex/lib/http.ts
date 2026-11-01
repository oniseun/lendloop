// Same envelope shape as the FLIQ API's ResponseFormat.
export interface ResponseFormat<T> {
  success: boolean;
  message: string;
  data?: T;
}

export const json = <T>(
  status: number,
  body: ResponseFormat<T>,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
