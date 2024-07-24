import {
    clusterApiUrl,
    sendAndConfirmTransaction,
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
    PublicKey,
} from '@solana/web3.js';

import {
    ExtensionType,
    createInitializeMintInstruction,
    mintTo,
    createAccount,
    getMintLen,
    TOKEN_2022_PROGRAM_ID,
    getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';

import {
    createInitializeTransferFeeConfigInstruction,
    harvestWithheldTokensToMint,
    transferCheckedWithFee,
    withdrawWithheldTokensFromAccounts,
    withdrawWithheldTokensFromMint,
} from '@solana/spl-token';

const payer = Keypair.generate();


async function main() {

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

     //Airdrop some SOL
     const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
     await connection.confirmTransaction({ signature: airdropSignature, ...(await connection.getLatestBlockhash()) });

    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;
    console.log(mint.toBase58());

    const transferFeeConfigAuthority = Keypair.generate();
    const withdrawWithheldAuthority = Keypair.generate();

    const extensions = [ExtensionType.TransferFeeConfig];

    const mintLen = getMintLen(extensions);
    
    const decimals = 9;
    const feeBasisPoints = 50;
    const maxFee = BigInt(5_000);

    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),

        createInitializeTransferFeeConfigInstruction(
            mint,
            transferFeeConfigAuthority.publicKey,
            withdrawWithheldAuthority.publicKey,
            feeBasisPoints,
            maxFee,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
            mint,
            decimals,
            payer.publicKey,
            null,
            TOKEN_2022_PROGRAM_ID
        ),
    );

    await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);


    //Transferring tokens with the fee checked
    const mintAmount = BigInt(1_000_000_000);

    const sourceAccount = await createAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    );

    console.log('Source account: ', sourceAccount.toBase58());

    await mintTo(
        connection,
        payer,
        mint,
        sourceAccount,
        payer.publicKey,
        mintAmount,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    );

    const account = Keypair.generate();

    const deestinationAccount = await createAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
        account,
        undefined,
        TOKEN_2022_PROGRAM_ID
    )

    console.log('Destination account: ', deestinationAccount.toBase58());

    const transferAmount = BigInt(1_000_000);
    const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000);

    console.log('Fee: ', fee);

    await transferCheckedWithFee(
        connection,
        payer,
        sourceAccount,
        mint,
        deestinationAccount,
        payer,
        transferAmount,
        decimals,
        fee,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    )


}

main();