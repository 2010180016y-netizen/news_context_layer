import { createServer as createNodeServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { FileNewsContextStore } from './repositories/file-store.js';
import { getBriefingForRequest, mapBriefingError } from './routes/briefings.js';
import {
  createCheckoutSessionForRequest,
  getRequestOrigin,
  getCheckoutToken,
  mapCheckoutError
} from './routes/checkout.js';
import { ingestEventForRequest } from './routes/events.js';
import { createApiHealthResponse } from './routes/health.js';
import { getProfileForRequest } from './routes/profile.js';
import { parseResolveRequest, readJsonBody, resolvePageContext } from './routes/resolve.js';
import {
  createWatchlistForRequest,
  deleteWatchlistForRequest,
  listWatchlistsForRequest,
  mapWatchlistError,
  updateWatchlistForRequest
} from './routes/watchlists.js';
import { BillingService } from './services/billing-service.js';
import { BriefingService } from './services/briefing-service.js';
import { ResolveService } from './services/resolve-service.js';

interface ApiMonitoringEvent {
  readonly kind: 'resolve_bad_request' | 'resolve_server_error';
  readonly path: '/v1/page/resolve';
  readonly message: string;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function writeNoContent(response: ServerResponse): void {
  response.writeHead(204, {
    'cache-control': 'no-store'
  });
  response.end();
}

function writeHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'text/html; charset=utf-8'
  });
  response.end(html);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, {
    location,
    'cache-control': 'no-store'
  });
  response.end();
}

function emitApiMonitoringEvent(event: ApiMonitoringEvent): void {
  console.warn('[news-context-api-monitoring]', JSON.stringify(event));
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  resolveService: Pick<ResolveService, 'resolve'>,
  store: FileNewsContextStore,
  billingService: BillingService,
  briefingService: BriefingService
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = requestUrl.pathname;

  if (request.method === 'GET' && request.url === '/health') {
    writeJson(response, 200, createApiHealthResponse());
    return;
  }

  if (request.method === 'POST' && pathname === '/v1/page/resolve') {
    try {
      const rawBody = await readJsonBody(request);
      const payload = parseResolveRequest(rawBody);
      
      try {
        const resolved = await resolvePageContext(payload, resolveService);
        writeJson(response, 200, resolved);
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Resolve failed.';
        emitApiMonitoringEvent({
          kind: 'resolve_server_error',
          path: '/v1/page/resolve',
          message
        });
        writeJson(response, 500, {
          error: 'Internal Server Error',
          message
        });
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid request.';
      emitApiMonitoringEvent({
        kind: 'resolve_bad_request',
        path: '/v1/page/resolve',
        message
      });
      writeJson(response, 400, {
        error: 'Bad Request',
        message
      });
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/v1/me') {
    try {
      writeJson(response, 200, await getProfileForRequest(request, store));
      return;
    } catch (error: unknown) {
      writeJson(response, 400, {
        error: 'Bad Request',
        message: error instanceof Error ? error.message : 'Invalid profile request.'
      });
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/v1/briefings') {
    try {
      writeJson(response, 200, (await getBriefingForRequest(request, briefingService)).briefing);
      return;
    } catch (error: unknown) {
      const mapped = mapBriefingError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'POST' && pathname === '/v1/checkout/session') {
    try {
      writeJson(response, 200, await createCheckoutSessionForRequest(request, billingService));
      return;
    } catch (error: unknown) {
      const mapped = mapCheckoutError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/billing/mock/checkout') {
    try {
      writeHtml(response, 200, billingService.renderMockCheckoutPage(getCheckoutToken(request)));
      return;
    } catch (error: unknown) {
      const mapped = mapCheckoutError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/billing/mock/complete') {
    try {
      redirect(response, await billingService.completeMockCheckout(getCheckoutToken(request)));
      return;
    } catch (error: unknown) {
      const mapped = mapCheckoutError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/billing/mock/cancel') {
    try {
      redirect(response, billingService.cancelMockCheckout(getCheckoutToken(request)));
      return;
    } catch (error: unknown) {
      const mapped = mapCheckoutError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/billing/mock/return') {
    try {
      const requestUrl = new URL(request.url ?? '/', getRequestOrigin(request));
      writeHtml(response, 200, billingService.renderMockReturnPage(requestUrl.toString()));
      return;
    } catch (error: unknown) {
      const mapped = mapCheckoutError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'GET' && pathname === '/v1/watchlists') {
    try {
      writeJson(response, 200, await listWatchlistsForRequest(request, store));
      return;
    } catch (error: unknown) {
      const mapped = mapWatchlistError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  if (request.method === 'POST' && pathname === '/v1/watchlists') {
    try {
      const created = await createWatchlistForRequest(request, store);
      writeJson(response, 201, created.item);
      return;
    } catch (error: unknown) {
      const mapped = mapWatchlistError(error);
      writeJson(response, mapped.statusCode, mapped.payload);
      return;
    }
  }

  const watchlistMatch = pathname.match(/^\/v1\/watchlists\/([^/]+)$/u);

  if (watchlistMatch !== null) {
    const watchlistId = watchlistMatch[1];

    if (watchlistId === undefined) {
      writeJson(response, 404, {
        error: 'Not Found'
      });
      return;
    }

    if (request.method === 'PATCH') {
      try {
        writeJson(response, 200, await updateWatchlistForRequest(request, store, watchlistId));
        return;
      } catch (error: unknown) {
        const mapped = mapWatchlistError(error);
        writeJson(response, mapped.statusCode, mapped.payload);
        return;
      }
    }

    if (request.method === 'DELETE') {
      try {
        await deleteWatchlistForRequest(request, store, watchlistId);
        writeNoContent(response);
        return;
      } catch (error: unknown) {
        const mapped = mapWatchlistError(error);
        writeJson(response, mapped.statusCode, mapped.payload);
        return;
      }
    }
  }

  if (request.method === 'POST' && pathname === '/v1/events') {
    try {
      writeJson(response, 202, await ingestEventForRequest(request, store));
      return;
    } catch (error: unknown) {
      writeJson(response, 400, {
        error: 'Bad Request',
        message: error instanceof Error ? error.message : 'Invalid event request.'
      });
      return;
    }
  }

  writeJson(response, 404, {
    error: 'Not Found',
  });
}

export function createServer(
  options: {
    store?: FileNewsContextStore;
    resolveService?: Pick<ResolveService, 'resolve'>;
    billingService?: BillingService;
    briefingService?: BriefingService;
  } = {}
) {
  const store = options.store ?? new FileNewsContextStore();
  const resolveService = options.resolveService ?? new ResolveService(store);
  const billingService = options.billingService ?? new BillingService(store);
  const briefingService = options.briefingService ?? new BriefingService(store);

  return createNodeServer((request, response) => {
    void handleRequest(request, response, resolveService, store, billingService, briefingService);
  });
}
