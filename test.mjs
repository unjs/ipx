import { createIPX, ipxFSStorage } from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./test/assets" }),
});

const source = await ipx("../assets2/bliss.jpg"); // access file outside ./public dir because of same prefix folder
const { data, format } = await source.process();
console.log(format); // print image format
