const axios = require("axios");
const fs = require("fs");

// Function to fetch the most popular Ruby gems libraries based on downloads
async function fetchData() {
  const apiUrl = "https://rubygems.org/api/v1/search.json";
  const perPage = 30;
  const totalRecords = 1000;

  let allRecords = [];

  const totalPages = Math.ceil(totalRecords / perPage);

  for (let page = 1; page <= totalPages; page++) {
    const params = {
      query: "*",
      sort: "downloads", // by default it is sorted based on download
      page,
    };
    try {
      const response = await axios.get(
        "https://rubygems.org/api/v1/search.json",
        { params }
      );

      const records = response.data;
      allRecords = allRecords.concat(records);
      console.log(allRecords.length);
      //   console.log(gems.map(({ name }) => name));
      //   console.log(gems.length);
    } catch (error) {
      console.error("Error fetching gems:", error);
    }
  }

  console.log("Fetched records:", allRecords.length);

  // Transform records for CSV writing

  allRecords.forEach((record) => {
    const { name } = record;

    if (["arr-pm"].includes(name)) {
      console.log(record);
    }
  });

  const csvData = allRecords.map((record) => ({
    name: record.name,
    url: record.homepage_uri || "N/A",
    github: record.source_code_uri || record.homepage_uri || "N/A",
    downloads: record.downloads,
  }));

  // Write data to CSV file
  const csvWriter = fs.createWriteStream("rubygems_records.csv");
  csvWriter.write("Name,Package URL,Github, Downloads\n");
  csvData.forEach((record) => {
    const { name, url, github, downloads } = record;
    csvWriter.write(`${name},${url},${github},${downloads}\n`);
  });
  csvWriter.end();

  console.log("CSV file has been written successfully.");
}

fetchData();
