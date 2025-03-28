import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

// Contract address for Mojo token
const MOJO_TOKEN_CONTRACT_ADDRESS = "0xf9e7D3cd71Ee60C7A3A64Fa7Fcb81e610Ce1daA5";

export interface Env {
  PRIVATE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS handling
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    try {
      if (request.method === "GET") {
        return new Response(JSON.stringify({
          status: "online",
          message: "Mojo Token Rewards API is running"
        }), { 
          status: 200, 
          headers: corsHeaders 
        });
      }
      
      if (request.method === "POST") {
        // Extract user address and mojo score from request
        const { address, mojoScore } = await request.json();
        
        if (!address || !mojoScore) {
          return new Response(JSON.stringify({ error: "Missing address or mojoScore" }), { 
            status: 400,
            headers: corsHeaders 
          });
        }

        // Mint the tokens
        const result = await mintMojoTokens(address, mojoScore, env.PRIVATE_KEY);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            txHash: result.transactionHash,
            blockNumber: result.blockNumber
          }),
          { headers: corsHeaders }
        );
      }
      
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message || "Internal Server Error" }), 
        { status: 500, headers: corsHeaders }
      );
    }
  }
};

// Function to mint Mojo tokens to the specified address
async function mintMojoTokens(userAddress: string, mojoScore: number, privateKey: string) {
  // Initialize SDK with private key on Optimism network
  const sdk = ThirdwebSDK.fromPrivateKey(
    privateKey,
    "optimism",
    {
      clientId: "e24d90c806dc62cef0745af3ddd76314", // Same client ID from your main.tsx
    }
  );

  // Get the token contract
  const mojoContract = await sdk.getContract(MOJO_TOKEN_CONTRACT_ADDRESS);
  
  // Convert the mojoScore to the proper token amount with 18 decimals
  const tokenAmount = ethers.utils.parseUnits(mojoScore.toString(), 18);
  
  // Call the mintTo function
  const tx = await mojoContract.call("mintTo", [userAddress, tokenAmount.toString()]);
  
  return {
    transactionHash: tx.receipt.transactionHash,
    blockNumber: tx.receipt.blockNumber
  };
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Api-Key, X-Auth-Token, Origin, Accept, Access-Control-Allow-Headers",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json"
};

function handleCORS(): Response {
  return new Response(null, { 
    status: 204,
    headers: corsHeaders
  });
} 