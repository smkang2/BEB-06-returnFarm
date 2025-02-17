import { globSource, create as ipfsHttpClient } from "ipfs-http-client";
const projectId = "2GMcgAqKYocbbvkZ4aE4taG8S17";
const projectSecret = "d60b8dd34063ab6ed9f3d0f7db1791eb";

const Web3 = require("web3");
const rpcURL = "https://goerli.infura.io/v3/b03f802e554f441786b51c437837bfe4";
const web3 = new Web3(rpcURL);
const ipfs = ipfsHttpClient("/ip4/127.0.0.1/tcp/5001");
const path = require("path");
const User = require("../../models/user");
const fs = require("fs");

const ipfsUpload = async (img) => {
  const addFile = await ipfs.add(img);
  const initUri = "https://ipfs.io/ipfs/";
  const mkUrl = initUri + addFile.cid;
  return mkUrl;
};

async function addFolder() {
  const auth =
    "Basic " + Buffer.from(projectId + ":" + projectSecret).toString("base64");
  const client = ipfsHttpClient({
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https",
    headers: {
      authorization: auth,
    },
  });
  let list = [];
  for await (const file of client.addAll(globSource("/uploads", "**/*"))) {
    console.log(file);
    list.push(file);
    if (list.length === 3) {
      break;
    }
  }
  return list;
}

const serverAddress = "0xA90dB6734F77B38cccf7346419491d8a2A0Babee";
const contract20ABI = require("../../smartContract/abi/erc20abi.json");
const contract20Address = "0x2e31c765e77457BBa686B4831627d929f56F3024";
const contract721ABI = require("../../smartContract/abi/erc721abi.json");
const contract721Address = "0x6645e7C6cc65888E8c41793CfBEEd5946bcBb47C";

const getethBalanceOf = async (address) => {
  return await web3.eth.getBalance(address).then((result) => {
    return parseInt(result);
  });
};

const getTOKENBalanceOf = async (address) => {
  const contract20 = new web3.eth.Contract(contract20ABI, contract20Address);
  return await contract20.methods
    .balanceOf(address)
    .call()
    .then((result) => {
      return parseInt(result);
    });
};

const setTimeoutPromise = (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), ms);
  });
};

const createNFT = async (req, res) => {
  const data = req.body;
  const address = data.address;
  const name = data.name;
  const description = data.description;

  console.log(req.files.length);
  ///0번은 썸네일 나머지는 파일들.
  let tokenURI;
  if (req.files.length == 1) {
    let testFile = fs.readFileSync(
      `uploads/test/${req.files[0].filename}`,
      null
    );
    let testBuffer = Buffer.from(testFile); //new Buffer -> Buffer.from
    const ipfsImgUrl = await ipfsUpload(testBuffer);
    console.log("ipfsImgurl : ", ipfsImgUrl);
    const metadata = {
      name: name,
      description: description,
      image: ipfsImgUrl,
    };

    const src = JSON.stringify(metadata);
    console.log(src);
    const metadataUrl = await ipfsUpload(src);
    console.log("metadatUrl : ", metadataUrl);
    tokenURI = metadataUrl;

    fs.unlink(`uploads/test/${req.files[0].filename}`, (err) => {
      console.log("error : ", err);
    });
  } else {
    const initUri = "https://ipfs.io/ipfs/";
    const multiUri = await addFolder();
    const multiCid = multiUri[multiUri.length - 1].cid;
    const imageUri = multiUri[0].cid;

    console.log(multiCid);
    console.log(String(multiCid));

    const metadata = {
      name: name,
      description: description,
      file: initUri + String(multiCid),
      image: initUri + String(imageUri),
    };

    const src = JSON.stringify(metadata);
    console.log(src);
    const metadataUrl = await ipfsUpload(src);
    console.log("metadatUrl : ", metadataUrl);
    tokenURI = metadataUrl;

    for (let i = 0; i < req.files.length; i++) {
      fs.unlink(`uploads/test/${req.files[i].filename}`, (err) => {
        console.log("error : ", err);
      });
    }
  }

  const callPrivateKey = await User.findOne({ where: { address: address } });
  const userPrivateKey = callPrivateKey.dataValues.private_key;

  const ethBalance = await getethBalanceOf(address);
  const tokenBalance = await getTOKENBalanceOf(address);

  console.log("user eth Balance : " + ethBalance);
  console.log("user token Balance : " + tokenBalance);

  if (ethBalance < 1000000000000000) {
    console.log("Insufficient gas");
    return res.status(400).send("가스비가 부족합니다. Faucet을 이용하세요");
  } else {
    if (tokenBalance <= 1) {
      console.log("Insufficient IP");
      return res.status(400).send("NFT 제작 비용이 부족합니다.");
    } else {
      try {
        const getApproveGasAmount = () => {
          const contract = new web3.eth.Contract(
            contract20ABI,
            contract20Address
          );
          const gasAmount = contract.methods
            .approve(contract721Address, 1)
            .estimateGas({ from: address });
          return gasAmount;
        };
        const callApproveGas = await getApproveGasAmount();
        const approveGas = Math.round(callApproveGas * 1.3);
        console.log("Gas Estimation for Approve : ", approveGas);

        //erc20 -> erc721 approve (buyer의 토큰으로 owner의 NFT를 구매할 있게 approve)
        let contract = new web3.eth.Contract(contract20ABI, contract20Address, {
          from: address,
        });
        let contractData = contract.methods
          .approve(contract721Address, 2)
          .encodeABI(); //Create the data for token transaction.
        let rawTransaction = {
          to: contract20Address,
          gas: approveGas,
          data: contractData,
        };

        web3.eth.accounts
          .signTransaction(rawTransaction, userPrivateKey)
          .then((signedTx) =>
            web3.eth.sendSignedTransaction(signedTx.rawTransaction)
          );

        await setTimeoutPromise(30000);
        console.log("✨✨✨✨✨");
        console.log(tokenURI);
        const getMintGasAmount = () => {
          const contract = new web3.eth.Contract(
            contract721ABI,
            contract721Address
          );
          const gasAmount = contract.methods
            .mintNFT(serverAddress, tokenURI, 1)
            .estimateGas({ from: address });
          return gasAmount;
        };
        const callMintGas = await getMintGasAmount();
        const mintGas = Math.round(callMintGas * 1.3);
        console.log("Gas Estimation for Mint : ", mintGas);

        let contract721 = new web3.eth.Contract(
          contract721ABI,
          contract721Address,
          { from: address }
        );
        let data721 = contract721.methods
          .mintNFT(serverAddress, tokenURI, 1)
          .encodeABI(); //(recipient, tokenuri, 가격)
        let rawTransaction721 = {
          to: contract721Address,
          gas: mintGas,
          data: data721,
        };

        const signedTx = await web3.eth.accounts.signTransaction(
          rawTransaction721,
          userPrivateKey
        );

        web3.eth
          .sendSignedTransaction(signedTx.rawTransaction)
          .then((req) => {
            console.log("wow 민트성공");
            return res.status(200).send(tokenURI);
          })
          .catch((err) => {
            console.log("민트 실패");
            return res.status(400).send("실패. 1분 후에 재시도 하세요");
          });
      } catch (err) {
        console.log("web3에러");
        console.log(err);
      }
    }
  }
};

export { createNFT };
