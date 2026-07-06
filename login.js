const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function delay(milliseconds) {
  return new Promise((r) => setTimeout(r, milliseconds));
}

async function askQuestion(query) {
  return new Promise((r) => {
    rl.question(query, (answer) => {
      r(answer.trim());
    });
  });
}

let browser, page;
const siteUrl = process.env.SITE_URL;
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

async function initialLogin() {
  browser = await puppeteer.launch({ headless: false });
  page = await browser.newPage();

  console.log("Launching webpage...");
  await page.goto(siteUrl);

  console.log("Loggin In...");
  await delay(2000);

  await page.type("username_selector", username);
  await page.type("password_selector", password);
  await page.click("submit_button_selector");

  /*
    After initial login, another page will open up
    prompting for button submission leading to MFA.
    Handle by waiting before continuing.
    */
  await delay(2000);
  await page.click("submit_mfa_request_button_selector");

  let code = await askQuestion("Enter MFA Code: ");
  await page.type("mfa_code_text_selector", code);
  await page.click("submit_mfa_button_selector");

  await delay(5000);
  console.log("Logged In.");

  /*
    After verification, site requires initial selections
    of relevant company and client. This will be hardcoded to
    select this first option, but will be handled later.
  */
  await page.waitForSelector("company_selector", {
    visible: true,
    timeout: 30000,
  });

  /* For reference, this company selector was a makeshift dropdown.
  Meaning that rather than directly clicking a value, it must first be
  opened using a click and then chosen */
  await page.click("company_selector");
  await page.waitForSelector("first_option_selector", {
    visible: true,
    timeout: 30000,
  });
  await page.click("first_option_selector");

  /*
  Client selector only becomes visible post selection of company value.
  */
  await page.waitForSelector("first_client_selector");
  await page.select("first_client_selector");
  await page.click("submit_comp_client_button");

  return page;
}

module.exports = {
  initialLogin,
};
