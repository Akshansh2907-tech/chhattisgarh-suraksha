import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const CONTRACT_NAME = "ReportRegistry";
const ARTIFACTS_PATH = path.resolve(
  process.cwd(),
  "blockchain/artifacts/contracts/ReportRegistry.sol/ReportRegistry.json"
);

let contract;
let provider;
let signer;

export async function initBlockchain() {
  try {
    // Connect to Hardhat / RPC node. Make URL configurable via env so
    // docker-compose or production can point to a different node.
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);

    // Wait for provider to be ready but fail fast if the node is not available.
    const readyPromise = provider.ready;
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Provider connection timeout to ${rpcUrl}`)), 8000));
    await Promise.race([readyPromise, timeout]);

    // Get signer (first account)
    const network = await provider.getNetwork();
    console.log('Connected to network:', network.chainId);
    
    const accounts = await provider.listAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available');
    }
    
    signer = await provider.getSigner(accounts[0].address);
    console.log('Using account:', await signer.getAddress());

    // Load contract ABI and bytecode (try multiple candidate locations)
    try {
      const candidates = [
        path.resolve(process.cwd(), 'blockchain/artifacts/contracts/ReportRegistry.sol/ReportRegistry.json'),
        path.resolve(process.cwd(), 'backend/blockchain/artifacts/contracts/ReportRegistry.sol/ReportRegistry.json')
      ];

      let artifactPath = null;
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          artifactPath = p;
          break;
        }
      }

      if (!artifactPath) {
        console.warn('Contract artifact not found in any candidate path. Skipping contract deployment. Candidates tried:', candidates);
        return null;
      }

      console.log('Looking for contract at:', artifactPath);
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

      // Deploy contract
      const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        signer
      );

      contract = await factory.deploy();
      const receipt = await contract.deploymentTransaction().wait();
      console.log('Contract deployed at:', receipt.contractAddress);

      return receipt.contractAddress;
    } catch (e) {
      console.error('Contract deployment error:', e);
      // Don't throw here so the server can continue running without blockchain features
      return null;
    }
  } catch (e) {
    console.error('Blockchain initialization error:', e);
    throw e;
  }
}

export function getContract() {
  if (!contract) throw new Error("Blockchain not initialized");
  return contract;
}

export async function submitReportToChain({
  issueType,
  description,
  severity,
  keywords,
  location,
  photoHash = "",
  additionalData = ""
}) {
  if (!contract) throw new Error("Blockchain not initialized");
  const tx = await contract.submitReport(
    issueType,
    description,
    severity,
    keywords,
    location,
    photoHash,
    additionalData
  );
  await tx.wait();
  return tx.hash;
}

export async function getAllReportsFromChain() {
  if (!contract) throw new Error("Blockchain not initialized");
  const count = await contract.getReportsCount();
  const reports = [];
  for (let i = 0; i < count; i++) {
    const r = await contract.getReport(i);
    reports.push({
      issueType: r.issueType,
      description: r.description,
      severity: r.severity,
      keywords: r.keywords,
      location: r.location,
      photoHash: r.photoHash,
      timestamp: Number(r.timestamp),
      additionalData: r.additionalData
    });
  }
  return reports;
}
