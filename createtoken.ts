import {
	createFungible,
	mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata'
import {
	createTokenIfMissing,
	findAssociatedTokenPda,
	getSplAssociatedTokenProgramId,
	mintTokensTo,
} from '@metaplex-foundation/mpl-toolbox'
import {
	generateSigner,
	percentAmount,
	createGenericFile,
	keypairIdentity,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { base58 } from '@metaplex-foundation/umi/serializers'
import fs from 'fs'

// 👇 Replace with your actual RPC endpoint (e.g., Helius, Quicknode, etc.)
const RPC_URL = 'https://api.devnet.solana.com'

// 👇 constant arrow function so you can import and test it
export const createSolanaToken = async () => {
	try {
		// --- 1. Initialize Umi ---
		const umi = createUmi(RPC_URL)
			.use(mplTokenMetadata())
			.use(irysUploader())

		// --- 2. Load existing wallet ---
		const walletFile = fs.readFileSync('./keypair.json', { encoding: 'utf-8' })
		const secretKey = new Uint8Array(JSON.parse(walletFile))
		const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey)

		umi.use(keypairIdentity(keypair))
		console.log('✅ Wallet loaded:', umi.identity.publicKey.toString())

		// --- 3. Upload image to Arweave via Irys ---
		const imageFile = fs.readFileSync('./image.png')
		const umiImageFile = createGenericFile(imageFile, 'image.png', {
			tags: [{ name: 'Content-Type', value: 'image/png' }],
		})

		console.log('📤 Uploading image...')
		const imageUri = await umi.uploader.upload([umiImageFile])
		console.log('✅ Image URI:', imageUri[0])

		// --- 4. Upload metadata ---
		const metadata = {
			name: 'My Solana Token',
			symbol: 'MYTOK',
			description: 'A demo token created on Solana using Umi',
			image: imageUri[0],
		}

		console.log('📤 Uploading metadata...')
		const metadataUri = await umi.uploader.uploadJson(metadata)
		console.log('✅ Metadata URI:', metadataUri)

		// --- 5. Create Mint Account ---
		const mintSigner = generateSigner(umi)
		console.log('🪙 Mint Address:', mintSigner.publicKey.toString())

		const createFungibleIx = createFungible(umi, {
			mint: mintSigner,
			name: metadata.name,
			uri: metadataUri,
			sellerFeeBasisPoints: percentAmount(0),
			decimals: 9, // you can change this to 0 if you want no decimals
		})

		// --- 6. Create Token Account for owner ---
		const createTokenIx = createTokenIfMissing(umi, {
			mint: mintSigner.publicKey,
			owner: umi.identity.publicKey,
			ataProgram: getSplAssociatedTokenProgramId(umi),
		})

		// --- 7. Mint tokens ---
		const mintTokensIx = mintTokensTo(umi, {
			mint: mintSigner.publicKey,
			token: findAssociatedTokenPda(umi, {
				mint: mintSigner.publicKey,
				owner: umi.identity.publicKey,
			}),
			amount: BigInt(1_000_000_000_000), // 1,000 tokens if 9 decimals
		})

		console.log('🚀 Sending transaction...')
		const tx = await createFungibleIx
			.add(createTokenIx)
			.add(mintTokensIx)
			.sendAndConfirm(umi)

		const signature = base58.deserialize(tx.signature)[0]
		console.log('\n✅ Transaction complete!')
		console.log(`🔗 Explorer TX: https://explorer.solana.com/tx/${signature}?cluster=devnet`)
		console.log(`🔗 Token Mint: https://explorer.solana.com/address/${mintSigner.publicKey}?cluster=devnet`)
		return mintSigner.publicKey.toString()
	} catch (err) {
		console.error('❌ Error:', err)
	}
}

// Run directly if executed as a script
if (process.argv[1] === new URL(import.meta.url).pathname) {
	createSolanaToken()
}
