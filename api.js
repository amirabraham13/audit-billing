const apiUrl = process.env.apiUrl;
const axios = require("axios");
const { stripTypeScriptTypes } = require("node:module");

async function checkInvoice(invoiceNumber) {
  try {
    console.log("CHECKING INVOICE...");
    const response = await axios.get("apiUrl_@_invoiceNum");
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

async function insertInvoice(invoice) {
  try {
    const response = await axios.post("apiUrl_@_invoiceNum", invoice);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

async function updateInvoice(invoice) {
  try {
    const response = await axios.put("apiUrl_@_invoiceNum", invoice);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

async function syncInvoiceToDatabase(invoice) {
  const invoiceExists = await checkInvoice(invoice.invoiceNumber);
  console.log(invoice);

  if (!invoiceExists) {
    await insertInvoice(invoice);
    console.log(`INSERTED INVOICE ${invoice.invoiceNumber}`);
  } else {
    await updateInvoice(invoice);
    console.log(`UPDATED INVOICE ${invoice.invoiceNumber}`);
  }
}

module.exports = {
  syncInvoiceToDatabase,
};