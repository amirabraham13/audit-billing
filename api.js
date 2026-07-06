const apiUrl = process.env.API_URL;
const axios = require("axios");
const { stripTypeScriptTypes } = require("node:module");

async function checkrecord(recordNumber) {
  try {
    console.log("CHECKING record...");
    const response = await axios.get(`${apiUrl}/${recordNumber}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

async function insertrecord(record) {
  try {
    const response = await axios.post(`${apiUrl}`, record);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

async function updaterecord(record) {
  try {
    const response = await axios.put("apiUrl_@_recordNum", record);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

async function syncrecordToDatabase(record) {
  const recordExists = await checkrecord(record.recordNumber);

  if (!recordExists) {
    await insertrecord(record);
    console.log(`INSERTED record ${record.recordNumber}`);
  } else {
    await updaterecord(record);
    console.log(`UPDATED record ${record.recordNumber}`);
  }
}

module.exports = {
  syncrecordToDatabase,
};