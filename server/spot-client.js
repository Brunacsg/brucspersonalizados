const fetch = global.fetch || require('node-fetch');
const SPOT_PERF_DEBUG = process.env.SPOT_PERF_DEBUG === 'true';

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class SpotClient {
    constructor({ baseUrl, accessKey }) {
        this.baseUrl = baseUrl.replace(/\/+$/,'') + '/';
        this.accessKey = accessKey;
        this.sessionToken = null;
        this.tokenExpiresAt = 0; // epoch ms
        this.authenticationPromise = null;
        this.requestTimeoutMs = Number(process.env.SPOT_REQUEST_TIMEOUT_MS) || 20000;
        this.requestRetries = Number(process.env.SPOT_REQUEST_RETRIES) || 1;
    }

    async fetchJson(url, options = {}, { timeoutMs = this.requestTimeoutMs, retries = this.requestRetries } = {}) {
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            const startedAt = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                const bodyText = await response.text();
                if (SPOT_PERF_DEBUG) {
                    console.log(`[spot-perf] spot-rest ${Date.now() - startedAt}ms path=${new URL(url).pathname} attempt=${attempt + 1}`);
                }
                let body = bodyText;
                try {
                    body = JSON.parse(bodyText);
                } catch {
                    // keep plain text body when JSON parsing fails
                }

                if (!response.ok) {
                    const message = typeof body === 'object'
                        ? body?.error || body?.message || JSON.stringify(body)
                        : String(body || '').slice(0, 300);
                    throw new Error(`HTTP ${response.status}${message ? `: ${message}` : ''}`);
                }

                return body;
            } catch (error) {
                if (SPOT_PERF_DEBUG) {
                    console.log(`[spot-perf] spot-rest-error ${Date.now() - startedAt}ms path=${new URL(url).pathname} attempt=${attempt + 1}`);
                }
                lastError = error;
                const isAbort = error && (error.name === 'AbortError' || /aborted|timeout/i.test(String(error.message || '')));
                const canRetry = attempt < retries;
                if (!canRetry) {
                    break;
                }

                if (!isAbort && !/network|fetch|ECONN|ENOTFOUND|EAI_AGAIN|HTTP 5\d\d/i.test(String(error.message || ''))) {
                    break;
                }

                await wait(150 * (attempt + 1));
            } finally {
                clearTimeout(timeoutId);
            }
        }

        throw lastError || new Error('Spot request failed');
    }

    async authenticate() {
        // If token still valid, reuse
        if (this.sessionToken && Date.now() < this.tokenExpiresAt) {
            return this.sessionToken;
        }

        if (this.authenticationPromise) {
            return this.authenticationPromise;
        }

        this.authenticationPromise = (async () => {
            if (!this.accessKey) {
                throw new Error('ACCESS_KEY is not configured');
            }

            const url = `${this.baseUrl}authenticateclient?AccessKey=${encodeURIComponent(this.accessKey)}`;
            const data = await this.fetchJson(url, { method: 'GET' }, { timeoutMs: this.requestTimeoutMs, retries: this.requestRetries });
            // Spot can return the token using different casings depending on the endpoint/version.
            const token = data.SessionToken || data.sessionToken || data.token || data.Token;
            if (!token) throw new Error('Authenticate: no SessionToken in response');

            // store token and set a default expiry (1 hour) unless API returns TTL
            this.sessionToken = token;
            this.tokenExpiresAt = Date.now() + (60 * 60 * 1000);
            return this.sessionToken;
        })();

        try {
            return await this.authenticationPromise;
        } finally {
            this.authenticationPromise = null;
        }
    }

    invalidateSession() {
        this.sessionToken = null;
        this.tokenExpiresAt = 0;
        this.authenticationPromise = null;
    }

    async request(path, { method = 'GET', body = null, params = {}, language = 'PT', includeLanguageParam = true } = {}) {
        const attemptRequest = async () => {
            const token = await this.authenticate();

            const url = new URL(this.baseUrl + path);
            url.searchParams.set('token', token);
            if (includeLanguageParam) {
                url.searchParams.set('lang', language);
            }
            Object.keys(params || {}).forEach(k => url.searchParams.append(k, params[k]));

            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };

            const opts = { method, headers };
            if (body) opts.body = JSON.stringify(body);

            return await this.fetchJson(url.toString(), opts, { timeoutMs: this.requestTimeoutMs, retries: this.requestRetries });
        };

        const data = await attemptRequest();
        if (data && typeof data === 'object' && [12, 13, 21, 22].includes(Number(data.ErrorCode))) {
            this.invalidateSession();
            return await attemptRequest();
        }

        return data;
    }
}

module.exports = SpotClient;
