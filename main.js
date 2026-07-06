const { initialLogin } = require("./login.js");
const { compClientLoop } = require("./loop.js");

async function main() {
  try {
    let page = await initialLogin();
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
    await compClientLoop(page);
    process.exit(1);
  } catch (error) {
    console.log(error);
    process.exit(0);
  }
}