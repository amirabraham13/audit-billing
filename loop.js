const puppeteer = require("puppeteer");
const { navToRecords, processRecord } = require("./processing.js");

// Helper Functions
function delay(milliseconds) {
  return new Promise((r) => setTimeout(r, milliseconds));
}

function scrollAndClick(element) {
  element.scrollIntoView({ block: "center" });
  element.click();
}

function getTextFromElements(elements) {
  const textValues = [];

  for (const element of elements) {
    textValues.push(element.textContent.trim());
  }

  return textValues;
}

function getOptionTextVals(options) {
  const textValues = [];

  for (const option of options) {
    textValues.push(option.textContent.trim());
  }
  return textValues;
}

function getOptionValueByIndex(select, index) {
  return select.options[index].value;
}

async function orgAccountLoop(page) {
  /*
    To create a loop through of organization + account pairings,
    I started by getting all possible organization values from
    the makeshift dropdown field. The length of which would become 
    the number of times my larger loop needed to run.
    */
  await page.click("organization_account_selector");
  await delay(2000);
  const orgs = await page.$$eval(
    "organization_options_selectors",
    getTextFromElements,
  );
  /*If not clicked again, even if not visible it is still
    loaded in dom and causes errors when looping*/
  await page.click("organization_account_selector");

  await delay(2000);

  for (let organization = 1; organization < orgs.length + 1; organization++) {
    await page.waitForSelector("organization_account_selector", {
      visible: true,
      timeout: 20000,
    });

    await page.click("organization_account_selector");

    await page.waitForSelector("account_selector", {
      visible: true,
      timeout: 15000,
    });

    await delay(1000);

    const organizationOptionSelector = `organization_selector:nth-child(${organization})`;
    await page.$eval(organizationOptionSelector, scrollAndClick);

    await delay(3000); // Allow buffor for accounts to update based on selected organization

    const accounts = await page.$$eval(
      "account_selector option",
      getOptionTextVals,
    );

    // We start and end here as the dropdown within the site has an empty
    // value in the first index
    for (let account = 1; account < accounts.length; account++) {
      const accountSelector = "account_selector";

      const accountValue = await page.$eval(
        accountSelector,
        getOptionValueByIndex,
        account,
      );

      await page.select(accountSelector, accountValue);

      await delay(3000);
      await page.click("go_button");

      await delay(5000);

      await navToRecords(page);

      let Records = await page.$$eval(
        "Record_links_selector",
        getTextFromElements,
      );

      if (Records.length == 0) {
        console.log("No Records to log.");
        continue;
      }

      for (let RecordIndex = 0; RecordIndex < Records.length; RecordIndex++) {
        await processRecord(page, RecordIndex);
      }
      await delay(3000);
    }
    console.log("Finished Scraping of account...");
  }
  console.log("Finished scraping of everything.");

  return;
}

module.exports = { orgAccountLoop };
