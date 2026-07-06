const { syncRecordToDatabase } = require("./api.js");
const { appendRowsToCSV } = require("./csv.js");

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
async function navigateToRecord(page, index) {
  const RecordRowSelector = "Record_link_selector";

  await page.waitForSelector(RecordRowSelector, {
    visible: true,
    timeout: 30000,
  });

  await page.$$eval(
    RecordRowSelector,
    (buttons, index) => {
      const button = buttons[index];

      button.scrollIntoView({ block: "center" });
      button.click();
    },
    index,
  );

  return page;
}

async function scrapeRecord(page) {
  const scrapedRecord = await scrapeRecordDetails(page);
  const cleanedRecord = cleanRecordDetails(scrapedRecord);

  await navigateToLineItems(page);
  const scrapedLineItems = await scrapeLineItems(page, cleanedRecord);

  const cleanedLineItems = cleanLineItems(scrapedLineItems, cleanedRecord);
  const Record = buildRecord(cleanedRecord, cleanedLineItems);

  await page.click("filter_selector");

  const RecordRowSelector = "Record_row_selector";

  await page.waitForSelector(RecordRowSelector, {
    visible: true,
    timeout: 30000,
  });

  const lineItemRecords = Record.lineItems.map((item) => ({
    platform: Record.platform,
    RecordId: Record.RecordId,
    ...item,
  }));

  await appendRowsToCSV('record_csv_file_path', [Record]);
  await appendRowsToCSV('line_items_csv_file_path', lineItemRecords);

  return Record;
}

async function scrapeRecordDetails(page) {
  let url = await page.url();
  let splitUrl = url.split("/");

  let platform = "Billing Platform";
  let domainReferenceNumber = splitUrl[5];
  let referenceNumber = await page.$eval("claim_num_selector", getElementValue);
  let RecordId = await page.$eval("Record_num_selector", getElementValue);
  let accountValue = await page.$eval("account_selector", getElementValue);
  let account = await page.$eval(
    `account_selector option[value="${accountValue}"]`,
    getTextContentValue,
  );
  let fileNumber = await page.$eval('file_number_selector', getElementValue);
  let RecordName = await page.$eval("case_name_selector", getTextContentValue);
  let releaseDate = await page.$eval(
    'release_date_selector',
    getElementValue,
  );
  let totalBilled = await page.$eval(
    "total_billed_selector",
    getTextContentValue,
  );
  let totaladjustments = await page.$eval(
    "total_adjustments_selector",
    getTextContentValue,
  );
  let totalApproved = await page.$eval(
    "total_approved_selector",
    getTextContentValue,
  );

  return {
    platform,
    domainReferenceNumber,
    referenceNumber,
    RecordId,
    account,
    fileNumber,
    RecordName,
    releaseDate,
    totalBilled,
    totaladjustments,
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

function cleanRecordDetails(scrapedRecord) {
  let totaladjustments = parseInt(
    scrapedRecord.totaladjustments.replace(/[^0-9.-]/g, ""),
    10,
  );
  let status = totaladjustments > 0 ? "PAID WITH adjustmentS" : "PAID IN FULL";
  let hasadjustments = status == "PAID WITH adjustmentS" ? true : false;

  let [month, day, year] = scrapedRecord.releaseDate.split("/").map(Number);
  let formattedReleaseDate = new Date(year, month - 1, day);
  let releaseDateMilliseconds = formattedReleaseDate.getTime();

  let expirationDateObj = new Date(formattedReleaseDate);
  expirationDateObj.setDate(expirationDateObj.getDate() + 30);
  let reviewDeadline = expirationDateObj.getTime();

  return {
    platform: scrapedRecord.platform,
    domainReferenceNumber: scrapedRecord.domainReferenceNumber,
    RecordId: scrapedRecord.RecordId,
    account: scrapedRecord.account,
    RecordName: scrapedRecord.RecordName,
    fileNumber:
      scrapedRecord.fileNumber == "--" ? null : scrapedRecord.fileNumber,
    referenceNumber:
      scrapedRecord.referenceNumber == "--" ? null : scrapedRecord.referenceNumber,
    releaseDate: releaseDateMilliseconds,
    totalBilled: parseInt(
      scrapedRecord.totalBilled.replace(/[^0-9.-]/g, ""),
      10,
    ),
    totaladjustments: totaladjustments,
    totalApproved: parseInt(
      scrapedRecord.totalApproved.replace(/[^0-9.-]/g, ""),
      10,
    ),
    appealCount: 0,
    appealResponses: 0,
    reviewDeadline: reviewDeadline,
    hasadjustments: hasadjustments,
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

async function scrapeLineItems(page, cleanedRecord) {
  const li_firstCells = await page.$$("first_table_cell_selector");

  const rowHandles = await page.$$("handle_selectors");

  const lineItemCount = li_firstCells.length;
  const rows = await buildLineItemRows(rowHandles);

  return {
    RecordId: cleanedRecord.RecordId,
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
    adjustmentReason: await getCellTextFromRow(row, 15),
  };
}

function cleanLineItems(scrapedLineItems, cleanedRecord) {
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
    let adjustmentReason = item.adjustmentReason;

    let adjustmentAmount = Math.abs(currentTotal - cost).toFixed(1);
    let adjustmentHours = ((hours * adjustmentAmount) / cost).toFixed(1);

    let [month, day, year] = rawDate.split("/").map(Number);
    let formattedDate = new Date(year, month - 1, day);
    let date = formattedDate.getTime();

    let isFee = type == "FEE";
    let hasadjustments = currentTotal != cost;

    return {
      platform: cleanedRecord.platform,
      RecordId: cleanedRecord.RecordId,
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
      hasadjustments: hasadjustments,
      adjustmentReason,
      adjustmentHours,
      adjustmentAmount,
      adjustmentRate: 0,
      adjustmentDescription: "",
    };
  });

  return {
    RecordId: cleanedRecord.RecordId,
    lineItemCount: scrapedLineItems.lineItemCount,
    rows: cleanedRows,
  };
}

function buildRecord(cleanedRecord, cleanedLineItems) {
  return {
    ...cleanedRecord,
    lineItemCount: cleanedLineItems.lineItemCount,
    lineItems: cleanedLineItems.rows,
  };
}

// ====================================================

async function navToRecords(page) {
  await delay(2000);
  await page.click("Record_link_selector");

  await delay(2000);
  console.log("Navigated to Records Page...");

  await page.waitForSelector("filter_Records_selector", {
    visible: true,
    timeout: 30000,
  });

  await page.click("filter_Records_selector");

  await page.waitForSelector("specific_filter_selector", {
    visible: true,
    timeout: 30000,
  });

  await page.click("specific_filter_selector");

  console.log("Implemented Records filter...");

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

async function processRecord(page, index) {
  await navigateToRecord(page, index);
  const currRecord = await scrapeRecord(page);
  await syncRecordToDatabase(currRecord);

  console.log("Finished looping through Record + line items.");
  return;
}

module.exports = {
  navToRecords,
  processRecord,
};