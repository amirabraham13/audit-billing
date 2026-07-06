const { syncInvoiceToDatabase } = require("./api.js");
const { appendRowsToCSV } = require("./csv.js");

const invoiceCSV = "invoices.csv";
const lineItemsCSV = "lineItes.csv";

// ============ Generic Helper Functions ==================
function delay(milliseconds) {
  return new Promise((r) => setTimeout(r, milliseconds));
}

function getElementValue(element) {
  return element.value.trim();
}

function getTextContentValue(element) {
  return element.textContent.trim();
}

// =============== Other Function Helpers ==========================
async function navigateToInvoice(page, index) {
  const invoiceRowSelector = "invoice_link_selector";

  await page.waitForSelector(invoiceRowSelector, {
    visible: true,
    timeout: 30000,
  });

  await page.$$eval(
    invoiceRowSelector,
    (buttons, index) => {
      const button = buttons[index];

      button.scrollIntoView({ block: "center" });
      button.click();
    },
    index,
  );

  return page;
}

async function scrapeInvoice(page) {
  const scrapedInvoice = await scrapeInvoiceDetails(page);
  const cleanedInvoice = cleanInvoiceDetails(scrapedInvoice);

  await navigateToLineItems(page);
  const scrapedLineItems = await scrapeLineItems(page, cleanedInvoice);

  const cleanedLineItems = cleanLineItems(scrapedLineItems, cleanedInvoice);
  const invoiceRecord = buildInvoiceRecord(cleanedInvoice, cleanedLineItems);

  await page.click("filter_selector");

  const invoiceRowSelector = "invoice_row_selector";

  await page.waitForSelector(invoiceRowSelector, {
    visible: true,
    timeout: 30000,
  });

  const lineItemRecords = invoiceRecord.lineItems.map((item) => ({
    platform: invoiceRecord.platform,
    invoiceNumber: invoiceRecord.invoiceNumber,
    ...item,
  }));

  await appendRowsToCSV(invoiceCSV, [invoiceRecord]);
  await appendRowsToCSV(lineItemsCSV, lineItemRecords);

  return invoiceRecord;
}

async function scrapeInvoiceDetails(page) {
  let url = await page.url();
  let splitUrl = url.split("/");

  let platform = "Billing Platform";
  let platformInvoiceNumber = splitUrl[5];
  let claimNumber = await page.$eval("claim_num_selector", getElementValue);
  let invoiceNumber = await page.$eval("invoice_num_selector", getElementValue);
  let clientValue = await page.$eval("client_selector", getElementValue);
  let client = await page.$eval(
    `client_selector option[value="${clientValue}"]`,
    getTextContentValue,
  );
  let fileNumber = await page.$eval('file_number_selector"]', getElementValue);
  let caseName = await page.$eval("case_name_selector", getTextContentValue);
  let releaseDate = await page.$eval(
    'release_date_selector"]',
    getElementValue,
  );
  let totalBilled = await page.$eval(
    "total_billed_selector",
    getTextContentValue,
  );
  let totalDeductions = await page.$eval(
    "total_deductions_selector",
    getTextContentValue,
  );
  let totalApproved = await page.$eval(
    "total_approved_selector",
    getTextContentValue,
  );

  return {
    platform,
    platformInvoiceNumber,
    claimNumber,
    invoiceNumber,
    client,
    fileNumber,
    caseName,
    releaseDate,
    totalBilled,
    totalDeductions,
    totalApproved,
  };
}

function hasLineItemsButton() {
  const buttons = Array.from(document.querySelectorAll("button"));

  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i].innerText.trim() == "Line Items") {
      return true;
    }
  }
  return false;
}

function clickLineItemsButton() {
  const buttons = Array.from(document.querySelectorAll("button"));
  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i].innerText.trim() == "Line Items") {
      buttons[i].scrollIntoView({ block: "center" });
      buttons[i].click();
      return;
    }
  }
  throw new Error("Line Items button was not found.");
}

function cleanInvoiceDetails(scrapedInvoice) {
  let totalDeductions = parseInt(
    scrapedInvoice.totalDeductions.replace(/[^0-9.-]/g, ""),
    10,
  );
  let status = totalDeductions > 0 ? "PAID WITH DEDUCTIONS" : "PAID IN FULL";
  let hasDeductions = status == "PAID WITH DEDUCTIONS" ? true : false;

  let [month, day, year] = scrapedInvoice.releaseDate.split("/").map(Number);
  let formattedReleaseDate = new Date(year, month - 1, day);
  let releaseDateMilliseconds = formattedReleaseDate.getTime();

  let expirationDateObj = new Date(formattedReleaseDate);
  expirationDateObj.setDate(expirationDateObj.getDate() + 30);
  let appealExpirationDate = expirationDateObj.getTime();

  return {
    platform: scrapedInvoice.platform,
    platformInvoiceNumber: scrapedInvoice.platformInvoiceNumber,
    invoiceNumber: scrapedInvoice.invoiceNumber,
    client: scrapedInvoice.client,
    caseName: scrapedInvoice.caseName,
    fileNumber:
      scrapedInvoice.fileNumber == "--" ? null : scrapedInvoice.fileNumber,
    claimNumber:
      scrapedInvoice.claimNumber == "--" ? null : scrapedInvoice.claimNumber,
    releaseDate: releaseDateMilliseconds,
    totalBilled: parseInt(
      scrapedInvoice.totalBilled.replace(/[^0-9.-]/g, ""),
      10,
    ),
    totalDeductions: totalDeductions,
    totalApproved: parseInt(
      scrapedInvoice.totalApproved.replace(/[^0-9.-]/g, ""),
      10,
    ),
    appealCount: 0,
    appealResponses: 0,
    appealExpirationDate: appealExpirationDate,
    hasDeductions: hasDeductions,
    status: status,
  };
}

async function navigateToLineItems(page) {
  await page.waitForFunction(hasLineItemsButton, { timeout: 30000 });
  await page.evaluate(clickLineItemsButton);

  console.log("Navigated to line items details...");
  await delay(3000);

  await page.waitForSelector("page_pagination_selector", {
    visible: true,
    timeout: 30000,
  });

  await page.select("page_pagination_selector", "max_value");
  console.log("Adjusted page display to max.");

  await delay(3000);

  return page;
}

async function getCellTextFromRow(row, index, fallback = undefined) {
  const cell = await row.$(`td:nth-child(${index + 1})`);

  const text = await cell.evaluate((el) => el.innerText.trim());

  return text || fallback;
}

async function scrapeLineItems(page, cleanedInvoice) {
  const li_firstCells = await page.$$("first_table_cell_selector");

  const rowHandles = await page.$$("handle_selectors");

  const lineItemCount = li_firstCells.length;
  const rows = await buildLineItemRows(rowHandles);

  return {
    invoiceNumber: cleanedInvoice.invoiceNumber,
    lineItemCount,
    rows,
  };
}

async function buildLineItemRows(rowHandles) {
  const rows = [];

  for (const row of rowHandles) {
    const lineItemRow = await buildLineItemRow(row);
    rows.push(lineItemRow);
  }

  return rows;
}

async function buildLineItemRow(row) {
  return {
    rawDate: await getCellTextFromRow(row, 3),
    type: await getCellTextFromRow(row, 4),
    lcode: await getCellTextFromRow(row, 5, ""),
    acode: await getCellTextFromRow(row, 6, ""),
    ecode: await getCellTextFromRow(row, 7, ""),
    hours: await getCellTextFromRow(row, 8),
    rate: await getCellTextFromRow(row, 9),
    cost: await getCellTextFromRow(row, 11),
    currentTotal: await getCellTextFromRow(row, 12),
    description: await getCellTextFromRow(row, 13),
    timeKeeperName: await getCellTextFromRow(row, 14, ""),
    deductionReason: await getCellTextFromRow(row, 15),
  };
}

function cleanLineItems(scrapedLineItems, cleanedInvoice) {
  const cleanedRows = scrapedLineItems.rows.map((item) => {
    let rawDate = item.rawDate;
    let lcode = item.lcode;
    let type = item.type == "FEE" ? "Time" : "Expense";
    let acode = item.acode;
    let ecode = item.ecode;
    let hours = parseFloat(item.hours).toFixed(1);
    let rate = parseFloat(item.rate).toFixed(1);
    let cost = parseFloat(item.cost).toFixed(1);
    let currentTotal = parseFloat(item.currentTotal).toFixed(1);
    let timekeeperInitials =
      type == "Expense"
        ? "EXPENSE"
        : item.timeKeeperName.match(/\b\w/g).join("");

    let description = item.description;
    let deductionReason = item.deductionReason;

    let deductionAmount = Math.abs(currentTotal - cost).toFixed(1);
    let deductionHours = ((hours * deductionAmount) / cost).toFixed(1);

    let [month, day, year] = rawDate.split("/").map(Number);
    let formattedDate = new Date(year, month - 1, day);
    let date = formattedDate.getTime();

    let isFee = type == "FEE";
    let hasDeductions = currentTotal != cost;

    return {
      platform: cleanedInvoice.platform,
      invoiceNumber: cleanedInvoice.invoiceNumber,
      rawDate,
      date,
      lcode,
      acode,
      ecode,
      type,
      timekeeperInitials,
      description,
      hours,
      rate,
      cost,
      currentTotal,
      hasDeductions: hasDeductions,
      deductionReason,
      deductionHours,
      deductionAmount,
      deductionRate: 0,
      deductionDescription: "",
    };
  });

  return {
    invoiceNumber: cleanedInvoice.invoiceNumber,
    lineItemCount: scrapedLineItems.lineItemCount,
    rows: cleanedRows,
  };
}

function buildInvoiceRecord(cleanedInvoice, cleanedLineItems) {
  return {
    ...cleanedInvoice,
    lineItemCount: cleanedLineItems.lineItemCount,
    lineItems: cleanedLineItems.rows,
  };
}

// ====================================================

async function navToInvoices(page) {
  await delay(2000);
  await page.click("invoice_link_selector");

  await delay(2000);
  console.log("Navigated to Invoices Page...");

  await page.waitForSelector("filter_invoices_selector", {
    visible: true,
    timeout: 30000,
  });

  await page.click("filter_invoices_selector");

  await page.waitForSelector("specific_filter_selector", {
    visible: true,
    timeout: 30000,
  });

  await page.click("specific_filter_selector");

  console.log("Implemented invoices filter...");

  await delay(2000);

  await page.waitForSelector("page_pagination_selector", {
    visible: true,
    timeout: 30000,
  });

  await page.select("page_pagination_selector", "max_value");
  console.log("Adjusted page display to max.");

  await delay(2000);

  return;
}

async function processInvoice(page, index) {
  await navigateToInvoice(page, index);
  const currInvoice = await scrapeInvoice(page);
  console.log(currInvoice);
  await syncInvoiceToDatabase(currInvoice);

  console.log("Finished looping through invoice + line items.");
  return;
}

module.exports = {
  navToInvoices,
  processInvoice,
};