# Fixture E2E tests

These Playwright tests run the production Studio build against Artflow-core and
the local OAuth/publisher mock. They exercise rendered page content, supported
login methods, token masking, navigation, UI task creation and asset review, and
publisher dry-run contracts. No live Pixiv account or publisher credentials are
needed. Dry-run assertions do not prove real uploads work.

Install both sibling checkouts with `npm ci`. Studio requires Node 20.19+ or
22.12+. From Studio:

```bash
npx playwright install chromium
npm run test:e2e
```

The default configuration starts
`../Artflow-core/scripts/dev/dev-stack.sh --fixture --prod` and terminates the
whole stack after the run. Set `ARTFLOW_CORE_DIR` for another core checkout.
Ports are 3300 (core), 3302 (mock) and 5373 (studio).

For isolated ports, set `ARTFLOW_E2E_BASE_URL=http://127.0.0.1:15373`,
`ARTFLOW_E2E_CORE_PORT=13300`, and `ARTFLOW_E2E_MOCK_PORT=13302`. Automatic
startup accepts a loopback HTTP base URL. To test an already running stack:

```bash
npm run test:e2e -- -c playwright.reuse.local.ts
```

The reuse configuration honors `ARTFLOW_E2E_BASE_URL` and
`ARTFLOW_E2E_MOCK_URL` (or `ARTFLOW_E2E_MOCK_PORT`) and does not manage servers.
Test failures retain screenshots, video, and retry traces in Playwright's test
output directory. API requests use Studio's same-origin proxy, so the frontend
and API tests always target the same stack.
