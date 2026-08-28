interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  API_ORIGIN: string;
}

const API_PATH = /^\/api(?:\/|$)/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);

    if (API_PATH.test(incomingUrl.pathname)) {
      const apiUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, env.API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set('Host', apiUrl.host);
      headers.set('X-Forwarded-Host', incomingUrl.host);
      headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

      return fetch(
        new Request(apiUrl, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'manual',
        }),
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || !['GET', 'HEAD'].includes(request.method)) {
      return assetResponse;
    }

    // Angular emits index.csr.html for client-rendered routes while index.html
    // is the SSR redirect shell. Use the CSR document for deep links so the
    // browser keeps the requested route and the Angular router can resolve it.
    const fallbackUrl = new URL('/index.csr.html', request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
