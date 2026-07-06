const apiUrl = process.env.API_URL;
const axios = require("axios");
const { stripTypeScriptTypes } = require("node:module");

async function checkRecord(RecordNumber) {
  try {
    console.log("CHECKING Record...");
    const response = await axios.get(`${apiUrl}/${RecordNumber}`);
    return response.data;
  } catch (error) {
    console.error({
      event: "api_request_failed",
      status: error.response?.status,
      message: error.message,
    });
  }
}

async function insertRecord(Record) {
  try {
    const response = await axios.post(`${apiUrl}`, Record);
    return response.data;
  } catch (error) {
    console.error({
      event: "api_request_failed",
      status: error.response?.status,
      message: error.message,
    });
  }
}

async function updateRecord(Record) {
  try {
    const response = await axios.put("apiUrl_@_RecordNum", Record);
    return response.data;
  } catch (error) {
    console.error({
      event: "api_request_failed",
      status: error.response?.status,
      message: error.message,
    });
  }
}

async function syncRecordToDatabase(Record) {
  const RecordExists = await checkRecord(Record.RecordNumber);

  if (!RecordExists) {
    await insertRecord(Record);
    console.log(`INSERTED Record ${Record.RecordNumber}`);
  } else {
    await updateRecord(Record);
    console.log(`UPDATED Record ${Record.RecordNumber}`);
  }
}

module.exports = {
  syncRecordToDatabase,
};