const puppeteer = require("puppeteer");
const { navToInvoices, processInvoice } = require("./processing.js");

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

async function compClientLoop(page) {
  /*
    To create a loop through of company + client pairings,
    I started by getting all possible company values from
    the makeshift dropdown field. The length of which would become 
    the number of times my larger loop needed to run.
    */
  await page.click("company_client_selector");
  await delay(2000);
  const companies = await page.$$eval(
    "company_options_selectors",
    getTextFromElements,
  );
  /*If not clicked again, even if not visible it is still
    loaded in dom and causes errors when looping*/
  await page.click("company_client_selector");

  await delay(2000);

  for (let company = 1; companies.length + 1; company++) {
    await page.waitForSelector("company_client_selector", {
      visible: true,
      timeout: 20000,
    });

    await page.click("company_client_selector");

    await page.waitForSelector("client_selector", {
      visible: true,
      timeout: 15000,
    });

    await delay(1000);

    const companyOptionSelector = `company_selector:nth-child(${company})`;
    await page.$eval(companyOptionSelector, scrollAndClick);

    await delay(3000); // Allow buffor for clients to update based on selected company

    const clients = await page.$$eval(
      "client_selector option",
      getOptionTextVals,
    );

    // We start and end here as the dropdown within the site has an empty
    // value in the first index
    for (let client = 1; client < clients.length; client++) {
      const clientSelector = "client_selector";

      const clientValue = await page.$eval(
        clientSelector,
        getOptionValueByIndex,
        client,
      );

      await page.select(clientSelector, clientValue);

      await delay(3000);
      await page.click("go_button");

      await delay(5000);

      await navToInvoices(page);

      let invoices = await page.$$eval(
        "invoice_links_selector",
        getTextFromElements,
      );

      if (invoices.length == 0) {
        console.log("No invoices to log.");
        continue;
      }

      for (
        let invoiceIndex = 0;
        invoiceIndex < invoices.length;
        invoiceIndex++
      ) {
        await processInvoice(page, invoiceIndex);
      }
      await delay(3000);
    }
    console.log("Finished Scraping of Client...");
  }
  console.log("Finished scraping of everything.");

  return;
}

module.exports = { compClientLoop };
