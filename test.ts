import { PublicKey } from "@solana/web3.js";

export interface SendSolanaParams {
	from: string,
	to: string
	amount: number
	
}

export interface SendSPLParams {
	from: string,
	to: string,
	contractAddress: string
	amount: number
}


const createSolanaWallet = async () => {
	try {

		const response = await fetch('https://api.thirdweb.com/v1/solana/wallets', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'x-secret-key': process.env.PROJECT_KEY_THIRDWEB || '',
            },
            body: JSON.stringify({
               label: "tamod",
            })
         });

         const data = await response.json();
         if (!response.ok) {
            throw new Error(data.message || 'Failed to create Solana wallet');
         }

		 console.log("✅ Solana wallet created:", data.result);

	} catch (error: any) {
		console.error("❌ createSolanaWallet error:", error);

	}
}


const listWallets = async () => {
   try {
      const response = await fetch('https://api.thirdweb.com/v1/solana/wallets?page=1&limit=10', {
         method: 'GET',
         headers: {
            'x-secret-key': process.env.PROJECT_KEY_THIRDWEB || '',

         }
      });

      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.message || 'Failed to list wallets');
      }

      console.log("✅ Wallets listed successfully:", data.result);

   } catch (error: any) {
      console.error("❌ listWallets error:", error);
   }
}


const sendSolanaToken = async (params: SendSolanaParams) => {
	// Convert SOL → lamports and make sure it's an integer
	const amountLamports = BigInt(Math.floor(params.amount * 1_000_000_000));

	// Convert lamports (amount) to 8-byte little-endian buffer
	const lamportsBuffer = Buffer.alloc(8);
	lamportsBuffer.writeBigUInt64LE(amountLamports);

	// Instruction discriminator for "Transfer" (2) as u32 little-endian
	const discriminator = Buffer.alloc(4);
	discriminator.writeUInt32LE(2);

	const data = Buffer.concat([discriminator, lamportsBuffer]).toString("base64");

	const body = {
		executionOptions: {
			chainId: "solana:devnet",
			signerAddress: params.from,
			commitment: "confirmed"
		},
		instructions: [
			{
				programId: "11111111111111111111111111111111",
				accounts: [
					{ pubkey: params.from, isSigner: true, isWritable: true },
					{ pubkey: params.to, isSigner: false, isWritable: true }
				],
				data,
				encoding: "base64"
			}
		]
	};

	const headers = {
		"Content-Type": "application/json",
		"x-client-id": process.env.X_CLIENT_ID || "",
		"x-vault-access-token": process.env.VAULT_ACCESS_TOKEN || ""
	};

	const res = await fetch("https://engine.thirdweb.com/v1/solana/transaction", {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	});

	const dataRes = await res.json();
	if (!res.ok) throw new Error(dataRes.error || "Transaction failed");
	return dataRes;
};


const sendSplTokenTx = async (params: SendSPLParams, decimals: number = 9) => {
	const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

	// Calculate raw amount based on decimals
	const amount = BigInt(Math.floor(params.amount * 10 ** decimals));

	// Instruction discriminator for SPL transfer = 3 (u8)
	// See: https://docs.rs/spl-token/latest/spl_token/instruction/enum.TokenInstruction.html
	const discriminator = Buffer.from([3]);

	// Data layout: u8 (3) + u64 (amount)
	const amountBuf = Buffer.alloc(8);
	amountBuf.writeBigUInt64LE(amount);
	const data = Buffer.concat([discriminator, amountBuf]).toString("base64");

	const body = {
		executionOptions: {
			chainId: "solana:devnet",
			signerAddress: params.from,
			commitment: "confirmed"
		},
		instructions: [
			{
				programId: TOKEN_PROGRAM_ID,
				accounts: [
					// Sender's token account (ATA)
					{ pubkey: await getAta(params.from, params.contractAddress), isSigner: false, isWritable: true },
					// Receiver's token account (ATA)
					{ pubkey: await getAta(params.to, params.contractAddress), isSigner: false, isWritable: true },
					// Owner of source account (sender wallet)
					{ pubkey: params.from, isSigner: true, isWritable: false }
				],
				data,
				encoding: "base64"
			}
		]
	};

	const headers = {
		"Content-Type": "application/json",
		"x-client-id": process.env.X_CLIENT_ID || "",
		"x-vault-access-token": process.env.VAULT_ACCESS_TOKEN || ""
	};

	const res = await fetch("https://engine.thirdweb.com/v1/solana/transaction", {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	});

	const dataRes = await res.json();
	if (!res.ok) throw new Error(dataRes.error || "SPL Token Transaction failed");
	return dataRes;
};


async function getAta(owner: string, mint: string): Promise<string> {
	const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
	const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvR93E6X3ez8gn5e4zWqVZxDC5uDPLWQmFE1");

	const [ata] = PublicKey.findProgramAddressSync(
		[
			new PublicKey(owner).toBuffer(),
			TOKEN_PROGRAM_ID.toBuffer(),
			new PublicKey(mint).toBuffer()
		],
		ASSOCIATED_TOKEN_PROGRAM_ID
	);
	return ata.toBase58();
}