import { createIPX, createIPXMiddleware } from "./src";

process.env.IPX_DIR = "test/assets";
process.env.IPX_ALIAS = '{"x/":"alias/"}';
process.env.IPX_DOMAINS =
  "https://avatars.githubusercontent.com, https://nuxtjs.org";

const ipx = createIPX({});
export default createIPXMiddleware(ipx);
