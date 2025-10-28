// try-send-combos.js
// Usage: bun run try-send-combos.js
// Make sure env vars are set: PROJECT_KEY_THIRDWEB, VAULT_ACCESS_TOKEN, WALLET_ACCESS_TOKEN (optional),
// X_CLIENT_ID (optional), X_TEAM_ID (optional)

const endpoint = "https://api.thirdweb.com/v1/solana/send";

// Config — edit these if you want
const FROM = process.env.FROM_WALLET || "Ca6iXuBexw6t87mZMpCGGCwRJZk2Go9rZk4BV6u7EW5r";
const TO = process.env.TO_WALLET || "98uHYfNEk9KgYMxU9y12xmnFWCzC7gdPNnRrpTRXput3";
// Amount in lamports as string (so 0.0001 SOL -> 100000 lamports)
const AMOUNT = process.env.AMOUNT || "100000";
const CHAIN = "solana:devnet";

// Read env keys
const PROJECT_KEY = process.env.PROJECT_KEY_THIRDWEB || process.env.PROJECT_KEY || "";
const VAULT_TOKEN = process.env.VAULT_ACCESS_TOKEN || process.env.VAULT_TOKEN || "";
const WALLET_TOKEN = process.env.WALLET_ACCESS_TOKEN || process.env.WALLET_TOKEN || "";
const CLIENT_ID = process.env.X_CLIENT_ID || process.env.CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || "";
const TEAM_ID = process.env.X_TEAM_ID || process.env.TEAM_ID || "";

// Helper to build header objects (removes empty values)
const buildHeaders = (raw: any) => {
	for (const k of Object.keys(raw)) {
		if (!raw[k] && raw[k] !== 0) delete raw[k];
	}
	return raw;
};

// Candidate header names for vault tokens and wallet tokens (try a few variants)
const vaultHeaderNames = [
	"x-vault-access-token",
	"x-vault-token",
	"x-vault",
	"x-vault-key",
	"x-vault-access",
];

const walletHeaderNames = [
	"x-wallet-access-token",
	"x-wallet-token",
	"x-wallet",
];

// Candidate auth placements for project key
const projectKeyVariants = [
	{ name: "x-secret-key", keyName: "x-secret-key", value: PROJECT_KEY },
	{ name: "authorization-bearer-project", keyName: "authorization", value: `Bearer ${PROJECT_KEY}` },
];

// Candidate auth placements for vault token
const vaultKeyVariants = vaultHeaderNames.map((n) => ({ name: n, keyName: n, value: VAULT_TOKEN }))
	.concat([{ name: "authorization-bearer-vault", keyName: "authorization", value: `Bearer ${VAULT_TOKEN}` }]);

// Candidate auth placements for wallet token
const walletKeyVariants = walletHeaderNames.map((n) => ({ name: n, keyName: n, value: WALLET_TOKEN }))
	.concat([{ name: "authorization-bearer-wallet", keyName: "authorization", value: `Bearer ${WALLET_TOKEN}` }]);

// Build combinations we will try.
// We'll try these strategies in this order (more likely first):
// 1) Vault-mode: headers with vault token only (and client/team)
// 2) Project-mode with vault mention in body (handled separately if needed) — but we'll still try project-only
// 3) Project-mode + vault header (some servers accept both)
// 4) Wallet token only
// 5) Project + wallet token
// We'll generate permutations from the above candidate lists.

const attempts = [];

// 1) Vault-only permutations (vault header variant + optional client/team)
for (const v of vaultKeyVariants) {
	attempts.push({
		label: `vault-only:${v.name}`,
		headers: buildHeaders({
			"Content-Type": "application/json",
			[v.keyName]: v.value,
			"x-client-id": CLIENT_ID,
			"x-team-id": TEAM_ID,
		}),
	});
}

// 1b) wallet-only permutations
for (const w of walletKeyVariants) {
	attempts.push({
		label: `wallet-only:${w.name}`,
		headers: buildHeaders({
			"Content-Type": "application/json",
			[w.keyName]: w.value,
			"x-client-id": CLIENT_ID,
			"x-team-id": TEAM_ID,
		}),
	});
}

// 2) Project key only
for (const p of projectKeyVariants) {
	attempts.push({
		label: `project-only:${p.name}`,
		headers: buildHeaders({
			"Content-Type": "application/json",
			[p.keyName]: p.value,
			"x-client-id": CLIENT_ID,
			"x-team-id": TEAM_ID,
		}),
	});
}

// 3) Project + vault combinations
for (const p of projectKeyVariants) {
	for (const v of vaultKeyVariants) {
		attempts.push({
			label: `project+vault:${p.name}+${v.name}`,
			headers: buildHeaders({
				"Content-Type": "application/json",
				[p.keyName]: p.value,
				[v.keyName]: v.value,
				"x-client-id": CLIENT_ID,
				"x-team-id": TEAM_ID,
			}),
		});
	}
}

// 4) Project + wallet combinations
for (const p of projectKeyVariants) {
	for (const w of walletKeyVariants) {
		attempts.push({
			label: `project+wallet:${p.name}+${w.name}`,
			headers: buildHeaders({
				"Content-Type": "application/json",
				[p.keyName]: p.value,
				[w.keyName]: w.value,
				"x-client-id": CLIENT_ID,
				"x-team-id": TEAM_ID,
			}),
		});
	}
}

// 5) Try combinations where project key is provided in Authorization and vault in x-secret-key (reverse)
if (PROJECT_KEY && VAULT_TOKEN) {
	attempts.push({
		label: `project-as-bearer + vault-as-x-secret`,
		headers: buildHeaders({
			"Content-Type": "application/json",
			"authorization": `Bearer ${PROJECT_KEY}`,
			"x-secret-key": VAULT_TOKEN, // weird but some misconfigurations expect this
			"x-client-id": CLIENT_ID,
			"x-team-id": TEAM_ID,
		}),
	});
}

// If none of the env vars exist, warn
if (!PROJECT_KEY && !VAULT_TOKEN && !WALLET_TOKEN) {
	console.error("⚠️ No PROJECT_KEY_THIRDWEB, VAULT_ACCESS_TOKEN or WALLET_ACCESS_TOKEN found in env. Exiting.");
	process.exit(1);
}

// Body used for all attempts
const payload = {
	from: FROM,
	to: TO,
	amount: AMOUNT,
	chainId: CHAIN,
};

// run attempts sequentially until success or exhausted
const run = async () => {
	console.log("=== Starting header-combo probing ===");
	for (let i = 0; i < attempts.length; i++) {
		const attempt = attempts[i];
		// skip attempts with missing key values
		const headerValues = Object.values(attempt.headers);
		const hasEmptyAuth = headerValues.every((v) => v === undefined || v === "");
		if (hasEmptyAuth) {
			console.log(`${i + 1}/${attempts.length} SKIP ${attempt.label} -> auth values missing`);
			continue;
		}

		console.log(`\n${i + 1}/${attempts.length} TRY ${attempt.label}`);
		console.log("Headers:", attempt.headers);
		console.log("Body:", payload);

		try {
			const resp = await fetch(endpoint, {
				method: "POST",
				headers: attempt.headers,
				body: JSON.stringify(payload),
			});

			const status = resp.status;
			let body;
			try {
				body = await resp.json();
			} catch (e) {
				body = await resp.text();
			}

			console.log("Status:", status);
			console.log("Response:", body);

			if (resp.ok) {
				console.log("\n✅ SUCCESS on attempt:", attempt.label);
				console.log("Returned body:", body);
				return { ok: true, attempt: attempt.label, status, body };
			}

			// If engine responds with engine_bad_request about missing token,
			// print more helpful hint
			if (body && body.error && typeof body.error === "string" && body.error.includes("Missing")) {
				console.log("→ Engine message mentions missing credentials.");
			}
		} catch (err) {
			console.error("Request error:", err);
		}
	}

	console.log("\n❌ All attempts exhausted — none returned success (2xx).");
	return { ok: false };
};

run().then((r) => {
	if (r && r.ok) {
		console.log("Done. Successful combo:", r.attempt);
	} else {
		console.log("Done. No successful combos.");
	}
	process.exit(0);
});
