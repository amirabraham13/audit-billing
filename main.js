const { initialLogin } = require("./login.js");
const { compClientLoop } = require("./loop.js");

async function main() {
  try {
    let page = await initialLogin();
    return new Promise((resolve) => setTimeout(resolve, 3000));
    await compClientLoop(page);
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

main();