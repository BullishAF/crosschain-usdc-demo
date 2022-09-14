import Hapi from "@hapi/hapi";
import { ethers, Signer } from "ethers";
import { version } from "./package.json";
import { privateKey } from "./secret.json";

const port = 4000;

// Mocked the MessageTransmitter contract address
const MESSAGE_TRANSMITTER_ADDRESS =
  "0x3cC062d269169FF4f4Ae6876db7da1DAfB454952";

function signMessage(signer: Signer, messageHash: string) {
  return signer.signMessage(messageHash);
}

const bootServer = async () => {
  const app = Hapi.server({
    port,
    host: "0.0.0.0",
  });
  await app.start();

  app.route({
    method: "GET",
    path: "/",
    handler: () => {
      return {
        success: true,
        version,
      };
    },
  });

  // The attestation service should observe for the "MessageSent" event to keep tracking of block confirmations.
  // But for simplicity, we will just sign the message and return the signature.
  app.route({
    method: "GET",
    path: "/v1/attestations/{messageHash}",
    handler: async (request: any, h: any) => {
      const destProvider = new ethers.providers.JsonRpcProvider(
        "https://rpc.testnet.fantom.network"
      );
      const signer = new ethers.Wallet(privateKey, destProvider);
      // Step 1: Get the message hash from the request
      const messageHash = request.params.messageHash;
      // Step 2: Sign messageHash to get the attestation (signature)
      const signature = await signMessage(signer, messageHash);
      // Step 3: Call "setMessage" at the MessageTransmitter contract to send the attestation to the blockchain
      const messageTransmitter = new ethers.Contract(
        MESSAGE_TRANSMITTER_ADDRESS,
        ["function setMessage(bytes32 messageHash, bytes signature)"],
        signer
      );
      const tx = await messageTransmitter
        .setMessage(messageHash, signature)
        .then((tx: any) => tx.wait());
      // Step 4: Return the attestation (signature)
      console.log("setMessage", tx.transactionHash);
      return {
        success: true,
        signature,
        hash: tx.transactionHash,
      };
    },
  });

  console.log(`Attestation API server is running at port ${port}...`);

  return app;
};
bootServer();

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});
