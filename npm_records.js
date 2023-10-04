const axios = require("axios");
const fs = require("fs");

async function fetchData() {
  const apiUrl = "https://registry.npmjs.com/-/v1/search";
  const batchSize = 250;
  const totalRecords = 1000;

  let allRecords = [];

  for (let offset = 0; offset < totalRecords; offset += batchSize) {
    const params = {
      size: batchSize,
      popularity: 1.0,
      quality: 0.0,
      maintenance: 0.0,
      text: "boost-exact:false",
      from: offset,
    };

    try {
      const response = await axios.get(apiUrl, { params });
      const records = response.data.objects;
      allRecords = allRecords.concat(records);
      console.log(allRecords.length);
    } catch (error) {
      console.error("Error fetching data:", error);
      break;
    }
  }

  console.log("Fetched records:", allRecords.length, allRecords[0]);
  // Process the fetched records here

  // Transform records for CSV writing
  const csvData = allRecords.map((record) => ({
    name: record.package.name,
    url: record.package.links.npm || "N/A",
    github: record.package.links.repository || "N/A",
    popularity: record.score.detail.popularity || 0.0,
  }));

  // Write data to CSV file
  const csvWriter = fs.createWriteStream("npm_records.csv");
  csvWriter.write("Name,Package URL,Github,Downloads\n");
  csvData.forEach((record) => {
    const { name, url, github, popularity } = record;
    csvWriter.write(`${name},${url},${github},${popularity}\n`);
  });
  csvWriter.end();

  console.log("CSV file has been written successfully.");
}

fetchData();
