const converter = require("json-2-csv");
const fs = require("fs");

async function appendRowsToCSV(filePath, rows) {
  if (!rows || rows.length === 0) {
    return;
  }
  const fileExists = fs.existsSync(filePath);
  const csv = await convertRowsToCSV(rows, fileExists);
  fs.appendFileSync(filePath, csv + "\n");

  return;
}

function convertRowsToCSV(rows, fileExists) {
  return new Promise(function handleCSVPromise(resolve, reject) {
    converter.json2csv(
      rows,
      function handleCSVConversion(err, csv) {
        if (err) {
          reject(err);
          return;
        }
        resolve(csv);
      },
      {
        prependHeader: !fileExists,
      },
    );
  });
}

module.exports = {
  appendRowsToCSV,
};
