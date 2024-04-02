import { alchemy, ethRpc, gamubllsContract } from "../utils";
import { Request, Response } from "express";
import axios from "axios";
import { ethers } from "ethers";
import { Alchemy, Network } from "alchemy-sdk";

export async function getWalletStakedNfts(req: Request, res: Response) {
  try {
    const { wallet } = req.params;
    if (!wallet) {
      return res.status(400).json({ message: "Missing wallet!" });
    }
    const walletStakedNfts = (
      await gamubllsContract.getStakedNfts(wallet)
    ).filter((w: any) => w[2]);

    const alchemy = new Alchemy({
      network:
        process.env.CHAIN_ENV === "development"
          ? Network.ETH_SEPOLIA
          : Network.ETH_MAINNET,
      apiKey: process.env.ALCHEMY_KEY,
    });

    const nfts: any[] = [];

    for (const wns of walletStakedNfts) {
      try {
        const nft = await alchemy.nft.getNftMetadata(
          gamubllsContract.target.toString(),
          wns[1]
        );

        if (!nfts.find((n) => n.image == nft.image.originalUrl)) {
          nfts.push({
            id: Number(wns[1]),
            staked: true,
            image: nft.image.originalUrl,
            mint: wns[1].toString(),
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    return res.status(200).json({ message: "Success", stakedNfts: [] });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
}

export async function unstakeBulls(req: Request, res: Response) {
  try {
    const { wallet } = req.body;

    if (!wallet) return res.status(400).json({ message: "Missing wallet!" });

    const unstakeData =
      gamubllsContract.interface.encodeFunctionData("unstakeAll");

    return res.status(200).json({
      tx: {
        from: wallet,
        to: gamubllsContract.target,
        data: unstakeData,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function stakeGambulls(req: Request, res: Response) {
  try {
    const { wallet, tokenIds } = req.body;

    if (!wallet) return res.status(400).json({ message: "Missing wallet!" });

    if (!tokenIds)
      return res.status(400).json({ message: "Missing token ids!" });

    const approve = gamubllsContract.interface.encodeFunctionData(
      "setApprovalForAll",
      [gamubllsContract.target, true]
    );

    const contractData = gamubllsContract.interface.encodeFunctionData(
      "stakeNft",
      [tokenIds]
    );

    let approveTx: any = {
      from: wallet,
      to: gamubllsContract.target,
      data: approve,
    };

    if (
      await gamubllsContract.isApprovedForAll(wallet, gamubllsContract.target)
    ) {
      approveTx = undefined;
    }

    return res.status(200).json({
      approve: approveTx,
      tx: {
        from: wallet,
        to: gamubllsContract.target,
        data: contractData,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function unstakeNfts(req: Request, res: Response) {
  try {
    const { wallet, tokenIds } = req.body;
    if (!wallet || !tokenIds) {
      return res.status(400).json({ message: "Invalid body!" });
    }

    const walletStakings = await gamubllsContract.getStakedNfts(wallet);

    for (const tokenId of tokenIds) {
      if (
        !walletStakings.find(
          (w: any) => Number(w.tokenId) === tokenId && w.isStaked
        )
      ) {
        return res
          .status(400)
          .json({ message: "You are not owner of some of NFTs!" });
      }
    }

    const tx = gamubllsContract.interface.encodeFunctionData("withdraw", [
      tokenIds,
    ]);

    return res.status(200).json({
      tx: {
        from: wallet,
        to: gamubllsContract.target,
        data: tx,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
