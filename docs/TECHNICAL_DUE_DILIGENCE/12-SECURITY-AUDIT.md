# 12 — Security Audit

Scope: `backend/server.js`, `backend/middlewares/*.js`, `backend/services/auth.service.js`, `backend/utils/license.js`, `backend/utils/featureGuard.js`, `backend/models/User.js`, `PermissionMatrix.js`, `backend/controllers/admin.controller.js`, `backend/seed.js`, `backend/.env`, `backend/package.json`; `frontend/src/utils/permissions.js`. Findings are ordered roughly by exploitability/severity for a real multi-tenant SaaS deployment, not by file location.

---

## 1. Transport & platform hardening — largely absent

`backend/package.json` declares exactly five runtime dependencies: `bcryptjs`, `cors`, `dotenv`, `express`, `jsonwebtoken`, `mongoose`. **There is no `helmet`, no `express-rate-limit`, no `express-mongo-sanitize`, no `hpp`, no request-body-size limit configuration, and no CSRF protection package anywhere in the dependency tree.**

```1:57:backend/server.js
const express = require('express');
...
app.use(cors({ ... }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
...
app.use('/api', require('./routes/index.js'));
...
app.use(errorHandler);
```

Concretely, this means:
- **No security headers** — no `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, or a Content-Security-Policy are ever set by the backend; whatever headers exist are whatever the hosting platform (e.g. Vercel, per the `!process.env.VERCEL` check) injects by default.
- **No rate limiting anywhere** — `POST /api/auth/login`, `/register`, `/forgot-password`, `/reset-password` (all pre-`authMiddleware`, i.e. reachable by anonymous callers) have **zero request-throttling**. An attacker can attempt unlimited password guesses against any known email address, or unlimited registration spam, with no lockout, no CAPTCHA, no exponential backoff, and no IP/account-based throttling of any kind. Combined with bcrypt's deliberately-slow hashing (section 2) this is *somewhat* self-limiting per-request but imposes no actual ceiling on total attempts over time.
- **No request body size limit configured** on `express.json()`/`express.urlencoded()` — Express's default body-size limit (100kb) applies implicitly, which happens to provide *some* protection, but it is inherited default behavior, not a deliberate security decision, and is easily insufficient reasoning to rely on for a public-facing SaaS API.
- **No input sanitization middleware** — Mongoose's own schema-level casting provides partial protection against classic NoSQL-injection-via-operator-injection (e.g. `{"email": {"$gt": ""}}`) for typed fields, but any endpoint that passes raw `req.query`/`req.body` values into a `find()` filter without an explicit type/shape check is exposed to this class of injection. `reportController.js`'s `companyId = (req) => req.companyId || req.query.companyId` pattern (section 3) is exactly this kind of unguarded query-parameter-to-filter pipeline, compounding the IDOR risk with a (lower-severity but present) injection surface.

---

## 2. Password hashing — adequate algorithm choice, dated work factor

```39:43:backend/models/User.js
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});
```
`bcryptjs` at **10 rounds** is a reasonable, industry-common default and a correct algorithm choice for password storage (salted, adaptive, resistant to rainbow tables) — this is **not** a critical finding by itself. However:
- 10 rounds was a common recommendation years ago; current OWASP guidance for `bcrypt` trends toward 12+ rounds on modern hardware to keep the same offline-brute-force cost margin as compute gets cheaper — this is a "should modernize" item, not a "broken" item.
- There is no password complexity policy anywhere in the registration/reset flow (`auth.controller.js`/`auth.service.js`) — `User.password` has no `minlength`, no complexity regex, nothing beyond "is a string" — an account can be registered with password `a`. Combined with no rate limiting (section 1), weak passwords are considerably easier to brute-force than they would be with even a minimal complexity floor.
- Password comparison (`userSchema.methods.comparePassword`) correctly uses `bcrypt.compare` (constant-time-safe) rather than a manual string comparison — no timing-attack surface here.

---

## 3. JWT authentication — no refresh, no revocation, 30-day lifetime, dev-mode weak secret

```15:24:backend/services/auth.service.js
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role, companyId: user.companyId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};
```
- **30-day expiry, no refresh-token mechanism, no revocation list.** A stolen/leaked JWT (from a compromised device, a logged XHR, a browser extension, an XSS payload, etc.) remains fully valid for **up to 30 days** with no way for the legitimate account holder or an administrator to invalidate it early — there is no `jti` blacklist, no `tokenVersion` field on `User` that a logout/password-change could bump, and no session-store lookup on each request (`auth.middleware.js` only calls `jwt.verify` + `User.findById`, never checks any revocation state). **Changing a password does not invalidate previously-issued tokens** — `resetPassword`/`changePassword` flows update `user.password` but never touch anything a still-valid JWT depends on, so an attacker who obtained a token before a "security" password reset retains full access for the remainder of the 30-day window regardless.
- **`role` and `companyId` are baked into the token payload at issuance time and never re-validated against fresh state except by re-fetching `User` on every request** (`auth.middleware.js:13`, `User.findById(decoded.id)`) — this partially mitigates stale-role risk (a `role` change does take effect on the next request, since `req.user` is refetched), but the token's own embedded `role`/`companyId` claims are never actually read or trusted by `auth.middleware.js` beyond the initial `decoded.id` lookup — meaning the JWT payload carries redundant/unused claims, which is not itself a vulnerability but indicates the token design wasn't fully thought through (why encode `role`/`companyId` in the token at all if every request re-fetches the live values from the DB?).
- **`JWT_SECRET`, as shipped in the actual `backend/.env` file, is the literal placeholder string `your_super_secret_jwt_key_here`** — not a randomly generated high-entropy secret. `auth.service.js` does have a defensive `if (!process.env.JWT_SECRET) throw new Error('FATAL...')` fail-fast check at module load (a good pattern in principle — it prevents the server from silently running with *no* secret, e.g. `jwt.verify(token, undefined)`), but that check only verifies the variable is *set*, not that it is a strong secret — a low-entropy, human-guessable, or default/placeholder value passes this check just as validly as a proper 256-bit random string. **Any placeholder value like this, if ever carried into a real deployment's environment configuration, would let an attacker who guesses or finds it forge arbitrary valid JWTs for any user ID/role/company, including `role: 'super_admin'`.** Whether this literal value is actually used in the team's real deployed production environment (as opposed to only in this local `.env`) could not be verified from the codebase alone, but its presence as the working development secret, combined with zero automated check anywhere in the codebase that would reject an obviously-weak `JWT_SECRET` at startup, is a real process gap.
- **The same `JWT_SECRET` doubles as the license-checksum HMAC pepper** (section 6) — this couples two independent trust boundaries (session authentication and license-key integrity) to a single secret value; compromising this one variable compromises both systems simultaneously, where a defense-in-depth design would use two independent secrets.

---

## 4. CORS policy — permissive by design, correctly scoped but with soft edges

```13:31:backend/server.js
const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true
}));
```
- **`if (!origin) return callback(null, true)`** — requests with no `Origin` header (curl, Postman, server-to-server, most mobile-app HTTP clients, and any tool that simply omits the header) bypass the CORS check entirely. This is by design for non-browser clients and is not itself a vulnerability (CORS is a browser-enforced mechanism; a non-browser client was never going to be stopped by CORS regardless of this line) — but it does mean CORS provides **zero protection** against any non-browser-based automated abuse, which is the majority of real-world API abuse tooling.
- **`/^http:\/\/localhost:\d+$/` matches any port on `localhost` over plain HTTP** — reasonable for local development ergonomics (matches the comment's intent — "Allow any localhost port (5173, 5174, 5175, etc.)" for Vite's auto-port-increment behavior), but this rule has no environment gate (no `if (NODE_ENV !== 'production')`) — **it is active in every environment, including a hypothetical production deployment**, meaning any local process on the same machine as a legitimate browser session (e.g. malware, another local dev server, a malicious browser extension proxying through `localhost`) satisfies this origin check in production too. This is a narrow, low-likelihood attack surface but is unconditional dead code from a security-hygiene perspective — a production build should not accept `localhost` origins at all.
- **`origin.endsWith('.vercel.app')`** whitelists **every** Vercel-hosted app globally, not just this project's own deployment. Any other developer's unrelated `.vercel.app` preview/production deployment — including one an attacker deliberately stands up — satisfies this check. Combined with `credentials: true` (which permits cookies/authorization headers to be sent cross-origin), **an attacker who deploys any static page to their own free Vercel account gets a CORS-whitelisted origin against this API**, letting them make authenticated cross-origin XHR/fetch calls from a page they control against a victim's active session (subject to the browser actually attaching credentials — for this Bearer-token-based auth scheme specifically, the practical exploitability is lower than for cookie-based auth, since the attacker's page would still need to already possess the victim's token to set the `Authorization` header; the main residual risk is CSRF-adjacent abuse of any cookie-based session state, if one existed, plus general trust-boundary sloppiness that a stricter allowlist would have avoided). Regardless of practical exploitability, whitelisting an entire third-party hosting provider's domain suffix is a broader trust grant than intended and should be scoped to the project's specific deployment domain(s) instead.

---

## 5. Subscription/license enforcement — development-mode global bypass

```5:17:backend/middlewares/subscription.middleware.js
const subscriptionMiddleware = async (req, res, next) => {
    // Skip check for super admins or in development environment
    if ((req.user && req.user.role === 'super_admin') || process.env.NODE_ENV === 'development') {
        if (req.user && req.user.companyId) {
            try {
                const company = await Company.findById(req.user.companyId);
                if (company) req.planId = company.planId;
            } catch (e) { /* Ignore database issues for dev fallback */ }
        }
        return next();
    }
    ...
```
This bypasses **all** subscription-status, license-expiry, and company-suspension checks whenever `process.env.NODE_ENV === 'development'` — which is a single environment-variable value, entirely outside the application's own control, that an operator or deployment script sets. **The `backend/.env` file actually present in this repository's working copy has `NODE_ENV=development` set** (`backend/.env:4`) — meaning any deployment that reuses this `.env` file as-is (a very plausible failure mode — copying `.env` verbatim to a new server is a common and easy mistake) would run with subscription/license enforcement **permanently disabled**, silently, with no logged warning that this bypass is active. This is functionally identical in effect to the featureGuard's `super_admin`-always-allowed bypass (section 7) but triggered by an even easier-to-mishandle configuration value rather than a role.

Separately, this same bypass being keyed off `role === 'super_admin'` (rather than `NODE_ENV`) is legitimate/intentional — a platform super-admin reasonably shouldn't be blocked by a *tenant's* subscription status, since they're not operating as that tenant commercially. The `NODE_ENV === 'development'` half of the `||` condition is the actual risk; it should never be able to affect a real deployment's enforcement posture regardless of how that deployment's environment variables happen to be configured, and ideally would be removed in favor of a test-only mock/stub at the test-harness level instead of a runtime code branch.

---

## 6. License key checksum — placeholder value shipped in a live code path

```220:238:backend/controllers/admin.controller.js
exports.generateLicense = async (req, res) => {
    try {
        const { companyId, expiresAt } = req.body;
        const key = generateLicenseKey(companyId);
        const license = await License.create({
            companyId,
            licenseKey: key,
            expiresAt,
            checksum: 'CHECKSUM_PLACEHOLDER' // Ideally actual checksum
        });
        await Company.findByIdAndUpdate(companyId, { licenseKey: key });
        res.status(201).json(license);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};
```
The super-admin-only `POST /api/admin/licenses/generate` endpoint (`07-API-AUDIT.md` §16) stores the **literal string `'CHECKSUM_PLACEHOLDER'`** as the license's `checksum` field, rather than computing a real HMAC via `license.js`'s `generateLicenseKey`/checksum logic — even though that correct logic already exists and is used elsewhere (`auth.service.register`'s trial-license creation computes a real `crypto.createHash('sha256')`-based checksum, `admin.controller.js`'s own `createCompany` — line 87 — does the same). This specific endpoint alone regressed to a hardcoded placeholder, meaning **every license manually generated through this admin action has a checksum field that can never match `license.js`'s `validateLicenseKey()` verification logic** for any code path that actually checks it (though as of this audit, `validateLicenseKey` itself does not appear to be called by any live request-handling code path — see `07-API-AUDIT.md` §16 for the broader observation that the license system's checksum verification is largely vestigial/unused in the request pipeline, which somewhat limits this specific bug's practical blast radius, but it remains a clear code-quality/consistency defect in a security-adjacent subsystem).

Additionally, `renewLicense` (`admin.controller.js:240-253`) updates `expiresAt`/`isActive` **without touching or re-validating `checksum` at all** — a renewed license keeps whatever checksum (real or placeholder) it started with, with no re-verification step confirming the license record's integrity at renewal time.

### 6.1 License checksum reuses the JWT signing secret as an HMAC pepper
```7:12:backend/utils/license.js
exports.generateLicenseKey = (companyId) => {
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    const data = `${companyId}-${random}`;
    const checksum = crypto.createHash('sha256').update(data + process.env.JWT_SECRET).digest('hex').substring(0, 4).toUpperCase();
    return `CMP-${random}-${checksum}`;
};
```
See section 3's note on secret reuse across trust boundaries. Independently of that coupling concern: the checksum is truncated to **4 hex characters** (16 bits of entropy) — combined with a publicly-knowable `companyId` (Mongo ObjectIds are not secret and are frequently visible in URLs/API responses/frontend state) and only a 2-byte (`crypto.randomBytes(2)`, 16-bit) random component, the full key's effective search space for an offline brute-force (if `JWT_SECRET` were ever guessed or leaked) is small enough that a real attacker with the pepper could enumerate valid-looking license keys for a known `companyId` without much difficulty. This is a low-priority finding given license-key validation doesn't appear to gate any live route today (per 6 above), but it's worth fixing alongside any future re-activation of license enforcement.

---

## 7. Feature/plan guard — `super_admin` universal bypass, no companyRole enforcement anywhere server-side

```6:26:backend/utils/featureGuard.js
exports.checkFeature = async (req, module, field = null) => {
    if (req.user && req.user.role === 'super_admin') return true;
    if (!req.planId) throw new Error("No plan associated with this request");
    const plan = await Plan.findById(req.planId);
    if (!plan) throw new Error("Plan not found");
    if (!plan.features.modules[module]) throw new Error(`Module '${module}' not allowed in your current plan`);
    if (field && !plan.features.fields[module]?.[field]) throw new Error(`Field '${field}' not allowed in your current plan`);
    return true;
};
```
- `super_admin` bypasses **every** module/field feature-flag check — reasonable for a platform operator inspecting/managing tenant data, but combined with `auth.middleware.js`'s "oldest company" tenant-fallback behavior (section 8) means a `super_admin` account effectively has unrestricted read/write access to one arbitrarily-chosen tenant's full transactional data through the exact same `guard()`-protected routes normal tenant users use, with no tenant-selection step, no audit trail entry recording *which* tenant's data was accessed via this fallback, and no UI indication to the super-admin that they are operating against tenant data at all (versus the dedicated `/api/admin/*` surface, which is explicitly platform-scoped).
- **`companyRole` (`owner`/`admin`/`manager`/`accountant`/`salesman`/`sales`/`viewer` on `User.js:23-27`) is never read, checked, or enforced by any backend middleware, route, or controller.** Confirmed by exhaustive search: the only backend files referencing `companyRole` at all are `auth.controller.js`/`auth.service.js`/`user.service.js` (which only *set* it during user creation/management) and `User.js` itself (schema definition) — no `routes/*.js`, no `middlewares/*.js`, and no `controllers/*.js` (outside user management) ever branch on `req.user.companyRole`. **This means the entire `companyRole`-based access model (`frontend/src/utils/permissions.js`'s `getPermissions()` — read-only-for-viewer/accountant, section-visibility-by-role, etc.) is enforced exclusively client-side, in JavaScript the end user's own browser executes and can trivially modify (browser devtools, a patched build, a direct API client, or simply replaying a captured request).** A `User` with `companyRole: 'viewer'` — whom the frontend UI never shows a "Save" button to, and who per `permissions.js:38` should have `canSave: false` — can, with nothing more than the same JWT already issued to them by a normal login, directly call `POST /api/sales`, `DELETE /api/parties/:id`, `PUT /api/accounting/journal`, or any other create/update/delete endpoint their company's **plan** (not role) permits, and the backend will process it exactly as if a `companyRole: 'owner'` had made the same call. The only thing gating any of these actions server-side is `authMiddleware` (is this a valid logged-in user of *some* company) and `guard(module)` (does the company's *plan* include this module) — neither of which has any concept of what that specific user is allowed to do within their own company.
- The `PermissionMatrix` model (`companyId → roles/sections`, a company-customizable granular permission structure, per-module `canView/canCreate/canEdit/canDelete/canExport/canPrint`) exists, is exposed via `/api/admin/dynamic-config/permissions` for a super-admin to configure per-company, but **is never read or enforced by any route/controller either** — confirmed the same way as `companyRole`: no controller outside the admin dynamic-config surface ever queries `PermissionMatrix` for the requesting user's actual permissions before executing an action. This is a fully-built, schema-complete, admin-configurable authorization system that has **no runtime enforcement wired up anywhere** — a company owner could configure a maximally-restrictive `PermissionMatrix` for their `sales` role (e.g. `canDelete: false` on every module) via the admin UI, and every `sales`-role user in that company would remain completely unaffected by it when calling the actual transactional APIs directly.

**Net effect:** the only real access-control boundary enforced by this backend, for any authenticated, non-suspended, actively-subscribed user, is **"which company do you belong to"** and **"does your company's plan include this module."** There is no meaningful within-company least-privilege enforcement anywhere in the request pipeline — every company user, regardless of their intended role, has identical create/read/update/delete power over every plan-permitted module's data.

---

## 8. IDOR / tenant-isolation risk via `companyId` query-parameter fallback

```17:17:backend/controllers/salesController.js
const companyId = req.companyId || req.query.companyId;
```
This exact pattern — `req.companyId` (the authoritative value `authMiddleware` derived from the caller's own JWT/user record) **falling back to `req.query.companyId`** (a client-supplied, entirely unvalidated request parameter) — recurs verbatim or near-verbatim across at least ten controller files: `salesController.js`, `purchaseController.js`, `partyController.js`, `itemController.js`, `jobController.js`, `inventoryController.js`, `gstController.js`, `accountingController.js`, `reportController.js` (as a shared helper, `const companyId = (req) => req.companyId || req.query.companyId;`), and `admin.controller.js`.

**The fallback only ever activates when `req.companyId` is falsy** — for a normal tenant `user` role, `authMiddleware` always sets `req.companyId = user.companyId` from the authenticated user's own DB record (never `null`/`undefined` for a properly-provisioned account), so **for the overwhelming majority of real requests from real tenant users, the `req.query.companyId` fallback is dead code that never triggers, and cross-tenant data leakage through this specific path does not occur for a normal, properly-configured user.** This materially limits the practical severity of this pattern for the common case.

The fallback becomes live, and genuinely dangerous, in exactly the cases where `req.companyId` is falsy — which happens for:
1. **Any `super_admin` user with no companies yet in the system at all** (the `Company.findOne().sort({createdAt:1})` fallback in `auth.middleware.js:24-31` finds nothing) — an edge case, but in that state, a `super_admin` hitting any of these endpoints with `?companyId=<any-real-tenant-id>` would have their request processed against **that attacker-chosen tenant**, with `super_admin`'s already-elevated `featureGuard` bypass (section 7) removing the last check that might otherwise stop it.
2. **Any future code path, integration, or bug that ever calls one of these controllers without going through `authMiddleware` first** (e.g. a new route accidentally mounted outside the global `/api` + `authMiddleware` pipeline described in `routes/index.js`, or a future internal service-to-service call that doesn't set `req.companyId`) — the fallback would silently and fully trust `req.query.companyId` with zero authentication of the value at all.
3. **Defense-in-depth failure mode:** even setting aside whether it's reachable *today*, this pattern means the code's authors clearly intended `companyId` to sometimes come from an untrusted client-supplied parameter — a future refactor that changes `authMiddleware`'s guarantees (e.g. to support an API-key-based integration that doesn't set `req.companyId` the same way) could reactivate this fallback for currently-authenticated normal users without anyone noticing, because the vulnerable code is already sitting there today, dormant, waiting for exactly that kind of upstream change.

**Recommendation embedded in this finding:** the correct fix is not "validate `req.query.companyId` more carefully" but to **remove the fallback entirely** — every one of these ~10+ call sites should use `req.companyId` alone and treat its absence as a 401/403, since a request that reaches these controllers without an `authMiddleware`-derived `companyId` should never be trusted to supply its own.

---

## 9. `super_admin` tenant bleed via "oldest company" fallback

```23:31:backend/middlewares/auth.middleware.js
// Super admin has no tenant — use first company for ERP data APIs
if (!req.companyId && user.role === 'super_admin') {
    const Company = require('../models/Company');
    const fallback = await Company.findOne().sort({ createdAt: 1 });
    if (fallback) {
        req.companyId = fallback._id;
        req.superAdminTenant = true;
    }
}
```
Every `super_admin` account, when it hits any tenant-scoped ERP route (Sales, Purchase, Accounting, GST, Reports, etc. — anything under the standard `/api` pipeline rather than the dedicated `/api/admin/*` surface), is **unconditionally bound to the single oldest company in the entire database**, by `createdAt` ascending, with no selection mechanism, no UI for the super-admin to pick a different tenant, and no way to know from the response alone which tenant's data they're viewing unless they separately notice `req.superAdminTenant: true` is set (and confirmed — this flag is never surfaced in any response body to the frontend; it's set on the Express `req` object only, for potential internal use, but no controller reads or returns it).

**Impact:**
- A super-admin who is meant to be managing the *platform* (companies, plans, subscriptions, licenses — the actual `/api/admin/*` domain) will, if they or any frontend code path calls a standard ERP endpoint (e.g. accidentally navigating to a tenant-facing report screen while logged in as `super_admin`), silently read and potentially **write** to the oldest tenant's live production data — creating sales invoices, posting accounting entries, modifying inventory — attributed to that tenant's `companyId`, with the super-admin having no indication this is happening rather than operating in some platform-level sandbox.
- This also means the "oldest company" in any deployment is a permanent, structurally-privileged blast radius for any super-admin action mistake — a newly-onboarded enterprise customer is comparatively safer from this specific risk than the very first company ever created on the platform (frequently a seed/demo/test company in practice, per `seed.js`'s `Acme Textile Mills`, but in a real production deployment, the oldest company would eventually become a genuine paying customer's tenant as the seed data ages out or gets cleaned up).
- There is no way to audit which specific super-admin action affected the fallback tenant after the fact beyond whatever the fallback tenant's own `AuditLog` entries show (attributed to the super-admin's `userId`, but with no distinguishing marker that the action happened via this "no tenant, borrowed the oldest one" mechanism rather than a legitimate tenant-scoped login).

---

## 10. Password reset — token generation is correct, delivery mechanism is not implemented

```226:245:backend/services/auth.service.js
exports.forgotPassword = async (email) => {
    const user = await User.findOne({ email });
    if (!user) return { message: 'If an account exists, a reset link has been sent.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = resetExpires;
    await user.save({ validateBeforeSave: false });

    // TODO: Send email with resetToken (raw, unhashed)
    // Example: await emailService.sendPasswordReset(email, resetToken);
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

    return { message: 'If an account exists, a reset link has been sent.', devToken: process.env.NODE_ENV === 'development' ? resetToken : undefined };
};
```
**What's done correctly:**
- Cryptographically strong random token (`crypto.randomBytes(32)`, 256 bits).
- Only the **SHA-256 hash** of the token is persisted (`user.passwordResetToken`) — the raw token is never stored, mirroring the standard "hash the reset token at rest" best practice (same pattern used correctly by, e.g., Django/Rails reset-token implementations) — a database compromise alone does not yield usable reset tokens.
- A 1-hour expiry window is reasonable.
- **User-enumeration is correctly prevented at the response level** — the function returns the identical generic message (`'If an account exists...'`) whether or not the email matches a real account, and does so at the same rough code-path shape (no early-return timing tell for the "user doesn't exist" case beyond the DB lookup itself, though a sufficiently precise timing side-channel — the real-user path does an extra `bcrypt`-free `save()` — is theoretically measurable but not a practical concern here since no password hashing occurs in this specific flow).

**What's not done:**
- **No actual email is ever sent.** The `TODO` comment and commented-out `emailService.sendPasswordReset(email, resetToken)` line confirm this is unfinished — there is no email service integration anywhere in the codebase (no nodemailer, SendGrid, SES, Postmark, or any transactional-email dependency in `package.json`). **The password-reset feature, as shipped, cannot actually deliver a reset link to a real user by any means the application itself provides.**
- **The raw, valid reset token is written to the server's console log** (`console.log(`[DEV] Password reset token for ${email}: ${resetToken}`)`) **unconditionally, regardless of `NODE_ENV`.** Unlike the `devToken` field in the returned object (which *is* correctly gated behind `process.env.NODE_ENV === 'development'` before being included in the HTTP response body), this `console.log` call has no environment guard at all — it runs in every environment, including a hypothetical production deployment, writing a live, currently-valid, unexpired password-reset token to whatever log aggregation/storage the hosting platform captures stdout into. Any party with read access to application logs (a hosting platform's log viewer, a misconfigured log-shipping pipeline, a compromised logging-adjacent service, or simply another engineer with log-dashboard access but no legitimate need to reset that specific user's password) can read this token directly and take over the account within its 1-hour validity window, entirely bypassing the "did the real user receive this email" step the design otherwise correctly gates.
- **`devToken` being returned in the API response body at all**, even gated behind a `NODE_ENV` check, is a meaningful design smell for the same reason as the `NODE_ENV`-gated subscription bypass (section 5): it makes "is this security control active" a function of an environment variable rather than a code path that's structurally absent from anything resembling a production build, and (as with section 5) the actual shipped `.env` in this working copy has `NODE_ENV=development` — meaning `devToken` would currently be returned directly in the JSON response to *any* caller of `POST /api/auth/forgot-password` for *any* registered email address, letting an unauthenticated attacker who merely knows (or guesses) a victim's email address reset that victim's password with a single unauthenticated HTTP request and zero access to email, logs, or anything else — no attacker capability beyond "can send an HTTP request" is required under the current environment configuration.

---

## 11. `.env` — real infrastructure credentials present, weak/placeholder secret, dev-mode flag

The `backend/.env` file present in this working copy (confirmed **git-ignored** — not committed to version control, so this specific finding does not indicate a public/repository-level leak, but does indicate the state of the actual running local configuration) contains:
- A **live MongoDB Atlas connection string with an embedded username and password**, pointing at a real Atlas cluster (`*.icxyasg.mongodb.net`). Storing live database credentials in a plaintext `.env` file is standard practice (the alternative — a secrets manager — is a maturity step most early-stage SaaS products don't have yet), but it underscores that **anyone with filesystem access to this backend's deployment host, or any backup/log/crash-dump that happens to capture this file's contents, gets full read/write access to 100% of every tenant's data** — there is no additional secret-rotation, IP-allowlisting-at-the-database-level cross-check, or credential-scoping (e.g. a read-only DB user for reporting paths) visible anywhere in the codebase; the application connects with one single, fully-privileged Mongo user for every operation.
- **`JWT_SECRET=your_super_secret_jwt_key_here`** — see section 3. This is a template/placeholder value, not a generated secret, sitting in the file that is actually loaded by `dotenv.config()` at server startup in this working copy.
- **`NODE_ENV=development`** — activates the subscription-bypass (section 5) and (given the current environment) the `devToken` password-reset exposure (section 10) simultaneously, from a single configuration line.
- **`WHATSAPP_API_KEY`, `WHATSAPP_PHONE_ID`, `WHATSAPP_DEFAULT_PHONE`** — all present as **empty values**, reserved for a Meta Cloud WhatsApp Business API integration. Grepping the codebase confirms these three variables are **never read by any backend code** — the actual WhatsApp "Share" feature (`frontend/src/utils/invoiceHelpers.js`'s `openWhatsAppShare()`) works entirely client-side via a `wa.me` deep link (opening the user's own WhatsApp client/app with a pre-filled message), which requires no API key at all. These three environment variables are dead configuration scaffolding for a server-side WhatsApp Business API send-flow that was never built — harmless as shipped (empty values, unused), but worth removing to avoid a future engineer assuming this integration exists and is simply "configured" rather than absent.

**None of these specific values (real password, weak secret) should be treated as still-valid/exploitable by a reader of this document beyond understanding the class of risk they represent** — they are documented here as an audit finding about the *practice* (real infra credentials and a placeholder secret coexisting in the same working `.env`), not as an invitation to use the literal values, which in any case should be rotated as a standard remediation step regardless of any other finding in this report.

---

## 12. Seed data — predictable default credentials

```43:73:backend/seed.js
const adminEmail = process.env.ADMIN_EMAIL || 'admin@textileerp.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
...
const userEmail = 'user@textileerp.com';
...
await authService.register('Test User', userEmail, 'User@123', 'Acme Textile Mills');
```
- The seed script's `super_admin` account defaults to `admin@textileerp.com` / `Admin@123` whenever `ADMIN_EMAIL`/`ADMIN_PASSWORD` environment variables are unset — a well-known-pattern default credential (predictable email local-part, `Admin@123`-style password satisfying a typical "must contain upper/lower/digit/symbol" complexity checker while still being trivially guessable) that, per the actual `.env` reviewed in section 11, **is not overridden** — no `ADMIN_EMAIL`/`ADMIN_PASSWORD` keys are present in the `.env` file, meaning **the platform's own `super_admin` account, the single most powerful account in the entire system (bypasses every plan/feature check, can access any tenant via the oldest-company fallback, can manage every company/plan/subscription/license), currently runs with these literal default credentials** unless something outside the reviewed codebase (a separate ops runbook, a manual post-seed password change) has changed it.
- The default tenant test user (`user@textileerp.com` / `User@123`, owner of `Acme Textile Mills`) has the identical predictable-default-password pattern, though its blast radius is scoped to that one seed tenant rather than the whole platform.
- Neither seeded account is forced to change its password on first login — there is no `mustChangePassword` flag on `User.js`, and no login-time check that would prompt a credential rotation for an account still using its seed-time default.
- **Recommendation implicit in this finding:** any real deployment must (a) always set `ADMIN_EMAIL`/`ADMIN_PASSWORD` to strong, unique, non-default values before running `seed.js` against a production database, and (b) ideally have the seed script itself refuse to fall back to hardcoded defaults when `NODE_ENV !== 'development'`, to make this mistake structurally harder to make rather than relying on operator discipline alone.

---

## 13. Summary Scorecard

| Control | Status |
|---|---|
| Password hashing algorithm | ✅ Correct choice (bcrypt), ⚠️ dated work factor (10 rounds), ❌ no complexity policy |
| Session/token model | ⚠️ Correctly signed & fail-fast on missing secret, ❌ no refresh/revocation, ❌ 30-day blast radius, ❌ placeholder secret in shipped `.env` |
| Rate limiting / brute-force protection | ❌ None anywhere, including on auth endpoints |
| Security headers (Helmet-equivalent) | ❌ None |
| CORS | ⚠️ Mostly scoped correctly, but `*.vercel.app`-wide and unconditional `localhost` rules are broader than necessary |
| Multi-tenant isolation (companyId) | ⚠️ Sound for the common case; ❌ dormant IDOR fallback pattern repeated across 10+ controllers; ❌ super-admin oldest-company tenant bleed |
| Within-company authorization (companyRole/PermissionMatrix) | ❌ Fully unenforced server-side — client-side only |
| Subscription/license enforcement | ❌ Global bypass via `NODE_ENV=development`, active in the current `.env` |
| License checksum integrity | ❌ Placeholder value in `generateLicense`; weak entropy design even when real |
| Password reset flow | ⚠️ Correct token hashing/expiry design, ❌ no email delivery implemented, ❌ unconditional token logging, ❌ dev-gated-but-currently-active token leak in API response |
| Secrets management | ❌ Real DB credentials + placeholder JWT secret in local `.env` (git-ignored, but indicative of practice) |
| Default credentials | ❌ Predictable super-admin and seed-tenant defaults, not forced to rotate |

**Verdict:** the codebase demonstrates awareness of several correct security patterns in isolation (bcrypt, hashed reset tokens, generic anti-enumeration messaging, a fail-fast missing-secret check, sound CORS intent) — this is not a codebase written with no security knowledge at all. But nearly every one of those correct patterns is undermined by an adjacent gap: hashed reset tokens are logged in plaintext anyway; a fail-fast secret check doesn't stop a placeholder secret; anti-enumeration messaging is defeated by a `devToken` field that's live under the shipped environment configuration; sound multi-tenant scoping is undermined by a dormant client-trusted fallback. Combined with the complete absence of rate limiting, security headers, and server-side role/permission enforcement, this system in its current state should be treated as **not production-ready from a security standpoint** for a multi-tenant SaaS handling real financial and GST-compliance data, independent of the functional/accounting findings documented in `10-ACCOUNTING-AUDIT.md` and `11-GST-AUDIT.md`.
